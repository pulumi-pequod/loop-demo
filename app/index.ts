import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const env = pulumi.getStack(); // dev | staging | prod
const name = `loop-api-${env}`;

const role = new aws.iam.Role(`${name}-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});
new aws.iam.RolePolicyAttachment(`${name}-logs`, {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

// SEEDED GAP (on purpose, for the video): no retentionInDays, so logs are kept forever.
// The agent's review finds this and opens the PR that adds retention.
const logs = new aws.cloudwatch.LogGroup(`${name}-logs`, {
    name: `/aws/lambda/${name}`,
});

const fn = new aws.lambda.Function(name, {
    name,
    runtime: aws.lambda.Runtime.NodeJS22dX,
    handler: "index.handler",
    role: role.arn,
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
