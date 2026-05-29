const { Stack, RemovalPolicy, Duration, CfnOutput } = require('aws-cdk-lib')
const dynamodb = require('aws-cdk-lib/aws-dynamodb')
const lambda = require('aws-cdk-lib/aws-lambda')
const s3 = require('aws-cdk-lib/aws-s3')
const apigw = require('aws-cdk-lib/aws-apigatewayv2')
const integrations = require('aws-cdk-lib/aws-apigatewayv2-integrations')
const path = require('path')

const ADMIN_PASSWORD = 'bowdoinhockey2026' // shared admin password; keep in sync with frontend

class HockeyStoreStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const table = (name) =>
      new dynamodb.Table(this, name, {
        tableName: `hockeystore-${name.toLowerCase()}`,
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.RETAIN, // never auto-delete order data
      })

    const storesTable = table('Stores')
    const rosterTable = table('Roster')
    const itemsTable = table('Items')
    const ordersTable = table('Orders')
    const settingsTable = table('Settings')

    const imagesBucket = new s3.Bucket(this, 'Images', {
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    })

    const fn = new lambda.Function(this, 'Api', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      timeout: Duration.seconds(15),
      memorySize: 256,
      environment: {
        STORES_TABLE: storesTable.tableName,
        ROSTER_TABLE: rosterTable.tableName,
        ITEMS_TABLE: itemsTable.tableName,
        ORDERS_TABLE: ordersTable.tableName,
        SETTINGS_TABLE: settingsTable.tableName,
        IMAGES_BUCKET: imagesBucket.bucketName,
        ADMIN_PASSWORD,
      },
    })

    storesTable.grantReadWriteData(fn)
    rosterTable.grantReadWriteData(fn)
    itemsTable.grantReadWriteData(fn)
    ordersTable.grantReadWriteData(fn)
    settingsTable.grantReadWriteData(fn)
    imagesBucket.grantPut(fn)

    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'hockeystore-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowHeaders: ['content-type', 'x-admin-password'],
      },
    })

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigw.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('LambdaInt', fn),
    })

    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint })
    new CfnOutput(this, 'ImagesBucketName', { value: imagesBucket.bucketName })
  }
}

module.exports = { HockeyStoreStack }
