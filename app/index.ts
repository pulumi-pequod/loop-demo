import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const env = pulumi.getStack(); // dev | staging | prod
const name = `loop-api-${env}`;

// Explicit tags on every taggable resource. Not using provider defaultTags: switching to an
// explicit provider changes the provider reference and would force replacement of all resources.
const tags = {
    Project: pulumi.getProject(),
    Environment: env,
    ManagedBy: "pulumi",
};

const role = new aws.iam.Role(`${name}-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
    tags,
});
new aws.iam.RolePolicyAttachment(`${name}-logs`, {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

// Log retention is set per environment via the `logRetentionDays` stack config
// (dev 7, staging 14, prod 90). Falls back to 30 days so logs are never kept forever.
const config = new pulumi.Config();
const logRetentionDays = config.getNumber("logRetentionDays") ?? 30;

const logs = new aws.cloudwatch.LogGroup(`${name}-logs`, {
    name: `/aws/lambda/${name}`,
    retentionInDays: logRetentionDays,
    tags,
});

const fn = new aws.lambda.Function(name, {
    name,
    runtime: aws.lambda.Runtime.NodeJS22dX,
    handler: "index.handler",
    role: role.arn,
    tags,
    code: new pulumi.asset.AssetArchive({
        "index.mjs": new pulumi.asset.StringAsset(
            `export const handler = async () => ({ statusCode: 200, body: JSON.stringify({ ok: true, env: "${env}" }) });`,
        ),
    }),
}, { dependsOn: [logs] });

const url = new aws.lambda.FunctionUrl(`${name}-url`, {
    functionName: fn.name,
    authorizationType: "NONE",
});

export const endpoint = url.functionUrl;
