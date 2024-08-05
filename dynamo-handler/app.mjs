import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({});

const dynamo = DynamoDBDocumentClient.from(client);

const tableName = "app-listings";

const AmenitySet = Object.freeze(
  new Set([
    "PARKING", 
    "POOL",
    "HOT_TUB",
    "WIFI",
    "COFFEE_MAKER",
    "LAUNDRY_SELF_SERVICE",
    "FIREPLACE",
  ])
);

async function getListing(listingId) {
  let getResponse = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        id: listingId,
      },
    })
  );
  return("Item" in getResponse ? getResponse.Item : null);
}

/*
 * Returns true if the given roomCount data of a listing object is
 * provided, but is either not an integer or is negative.
 */
function checkForNonIntegerOrNegative(listing, roomCountName) {
  return((listing[roomCountName] !== undefined) &&
         ((!(Number.isInteger(listing[roomCountName]))) || (listing[roomCountName] < 0)));
}

/*
 * Validates the data of a listing object.  Returns a
 * list of validation error messages, or an empty list
 * if there are no errors.
 */
function validateListing(listing) {
  const result = [];
  if (listing.description === undefined) {
    result.push("Required field: description");
  }
  if (listing.bathFullCount === undefined) {
    result.push("Required field: bathFullCount");
  }
  if (listing.bedCount === undefined) {
    result.push("Required field: bedCount"); 
  }
  if (listing.amenities !== undefined) {
    const badAmenities = listing.amenities.filter((am) => !AmenitySet.has(am));
    if (badAmenities.length > 0) {
      result.push("Unrecognized amenities values: " + badAmenities);
    }
  }

  if (checkForNonIntegerOrNegative(listing, 'bathFullCount')) {
    result.push("Field value bathFullCount must be non-negative integer");
  }
  if (checkForNonIntegerOrNegative(listing, 'bathHalfCount')) {
    result.push("Field value bathHalfCount must be non-negative integer");
  }
  if (checkForNonIntegerOrNegative(listing, 'bedCount')) {
    result.push("Field value bedCount must be non-negative integer");
  }
  if (checkForNonIntegerOrNegative(listing, 'livingCount')) {
    result.push("Field value livingCount must be non-negative integer");
  }
  if (checkForNonIntegerOrNegative(listing, 'kitchenCount')) {
    result.push("Field value kitchenCount must be non-negative integer");
  }
  if (checkForNonIntegerOrNegative(listing, 'diningCount')) {
    result.push("Field value diningCount must be non-negative integer");
  }
  return result;
}

export const handler = async (event, context) => {
  let body = null;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
  };

  try {
    let requestJSON = event.body ? JSON.parse(event.body) : null;
    if (event.routeKey === "DELETE /listings/{id}") {
      body = await getListing(event.pathParameters.id);
      if (body === null) {
        // listing with that id did not exist, return not found
        statusCode = 404;
      }
      else {
        await dynamo.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              id: event.pathParameters.id,
            },
          })
        );
        body = null;
        statusCode = 204;
      }
    }
    else if (event.routeKey === "GET /listings/{id}") {
      body = await getListing(event.pathParameters.id);
      if (body === null) {
        statusCode = 404;
      }
    }
    else if (event.routeKey === "PUT /listings/{id}") {
      body = await getListing(event.pathParameters.id);
      if (body === null) {
        // listing with that id did not exist, return not found
        statusCode = 404;
      }
      else {
        const putResponseItem = {
          id: event.pathParameters.id,
          description: requestJSON.description,
          amenities: requestJSON.amenities,
          bathFullCount: requestJSON.bathFullCount,
          bathHalfCount: requestJSON.bathHalfCount,
          bedCount: requestJSON.bedCount,
          livingCount: requestJSON.livingCount,
          kitchenCount: requestJSON.kitchenCount,
          diningCount: requestJSON.diningCount
        };

        const validationErrors = validateListing(putResponseItem);
        if (validationErrors.length === 0) {
          // listing is valid, send it
          await dynamo.send(
            new PutCommand({
              TableName: tableName,
              Item: putResponseItem,
            })
          );
          body = putResponseItem;
        }
        else {
          statusCode = 400;
          body = { errorMessages : validationErrors };
        }
      }
    }
    else if (event.routeKey === "GET /listings") {
      body = await dynamo.send(
        new ScanCommand({ TableName: tableName })
      );
      body = body.Items;
    }
    else if (event.routeKey === "POST /listings") {
       const postResponseItem = {
        id: randomUUID(),
        description: requestJSON.description,
        amenities: requestJSON.amenities,
        bathFullCount: requestJSON.bathFullCount,
        bathHalfCount: requestJSON.bathHalfCount,
        bedCount: requestJSON.bedCount,
        livingCount: requestJSON.livingCount,
        kitchenCount: requestJSON.kitchenCount,
        diningCount: requestJSON.diningCount
      };

      const validationErrors = validateListing(postResponseItem);
      // extra POST check; do not allow clients to create id values
      if ("id" in requestJSON) {
        validationErrors.push("Listing id must not be provided for POST");
      }

      if (validationErrors.length === 0) {
        // listing is valid, send it

        body = await dynamo.send(
          new PutCommand({
            TableName: tableName,
            Item: postResponseItem,
          })
        );
        statusCode = 201;
        body = postResponseItem;
      }
      else {
        statusCode = 400;
        body = { errorMessages : validationErrors };
      }
    }
    else {
      throw new Error(`Unsupported route: "${event.routeKey}"`);
    }
  }
  catch (err) {
    statusCode = 500;
    body = { errorMessages : [ err.message ] };
  }
  finally {
    if (body !== null) {
      body = JSON.stringify(body);
    }
  }

  return {
    statusCode,
    body,
    headers,
  };
};