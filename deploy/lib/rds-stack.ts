import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Vpc,
  Peer,
  Port,
  InstanceType,
  InstanceClass,
  InstanceSize,
  SubnetType,
  ISecurityGroup
} from "aws-cdk-lib/aws-ec2";
import { DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion } from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

interface RdsStackProps extends StackProps {
  VPC: Vpc;
  securityGroup: ISecurityGroup;
}

export class RdsStack extends Stack {
  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const { VPC, securityGroup } = props;

    securityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(5432),
      "Allow PostgreSQL access from API instance"
    );

    const dbCredentials = new Secret(this, "DBCredentials", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 16
      }
    });

    const privateSubnet = VPC.selectSubnets({
      subnetGroupName: 'PrivateSubnet',
    }).subnets[0];

    const database = new DatabaseInstance(this, "Database", {
      vpc: VPC,
      vpcSubnets: {
        subnets: [privateSubnet]
      },
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_15
      }),
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      allocatedStorage: 1,
      maxAllocatedStorage: 2,
      securityGroups: [securityGroup],
      credentials: {
        username: dbCredentials.secretValueFromJson("username").toString(),
        password: dbCredentials.secretValueFromJson("password")
      },
      backupRetention: Duration.days(7),
      preferredBackupWindow: "03:00-04:00",
      preferredMaintenanceWindow: "Mon:04:00-Mon:05:00",
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: "myapp"
    });

    new CfnOutput(this, "DatabaseEndpoint", {
      value: database.instanceEndpoint.hostname,
      description: "Database endpoint"
    });

    new CfnOutput(this, "DatabaseCredentialsArn", {
      value: dbCredentials.secretArn,
      description: "Database credentials ARN"
    });
  }
}
