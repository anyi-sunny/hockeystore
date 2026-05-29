#!/usr/bin/env node
const cdk = require('aws-cdk-lib')
const { HockeyStoreStack } = require('../lib/stack')

const app = new cdk.App()
new HockeyStoreStack(app, 'HockeyStoreStack', {
  env: { region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
})
