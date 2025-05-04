#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { Ec2WebappStack } from '../lib/ec2-webapp-stack';
import { Ec2ApiStack } from '../lib/ec2-api-stack';
import { RdsStack } from '../lib/rds-stack';

const _env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const app = new cdk.App();

const vpcStack = new VpcStack(app, 'VpcStack', {
  env: _env,
});

new Ec2WebappStack(app, 'Ec2WebappStack', {
  env: _env,
  VPC: vpcStack.VPC
});

const ec2ApiStack = new Ec2ApiStack(app, 'Ec2ApiStack', {
  env: _env,
  VPC: vpcStack.VPC
});

new RdsStack(app, 'RdsStack', {
  env: _env,
  VPC: vpcStack.VPC,
  securityGroup: ec2ApiStack.securityGroup
});
