#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { WebappEc2Stack } from '../lib/webapp-ec2-stack';

const _env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const app = new cdk.App();

const vpcStack = new VpcStack(app, 'VpcStack', {
  env: _env,
});

const webappEc2Stack = new WebappEc2Stack(app, 'WebappEc2Stack', {
  env: _env,
  vpc: vpcStack.vpc
});
