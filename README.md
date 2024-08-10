This is an API I created for a recent tech interview.  It's a deployable AWS Cloudformation project that instantiates a basic CRUD REST api to manage listings for an Airbnb-type site.  The listings get persisted in DynamoDB.

To create this I started with the tutorial code from https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-dynamo-db.html and modified it for my listings domain.  Included is an OpenAPI YAML document  I created that I used to design the API.
