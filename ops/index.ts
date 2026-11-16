import * as pulumi from "@pulumi/pulumi";
import * as ps from "@pulumi/pulumiservice";

const org = pulumi.getOrganization();

// The ESC environment loop-app's stacks import for AWS credentials. Opening it lets the agent run
// `pulumi preview` to check a fix. Opening an environment is not deploying: without stack:write
// the role still cannot run `pulumi up`.
const awsAccess = ps.getEnvironmentOutput({ organizationName: org, projectName: "cloud-access", name: "aws-access" });

// Least privilege: the agent can read stacks, their update logs and state, search resources,
// and open the one environment loop-app needs for a preview.
// It cannot deploy and it cannot approve. Widening this takes a pull request.
const role = new ps.OrganizationRole("loop-troubleshooter-role", {
    organizationName: org,
    name: "loop-deploy-troubleshooter",
    description: "Read stacks, their history and state, search resources, open cloud-access/aws-access for previews. No deploy, no approve.",
    permissions: ps.buildRolePermissionsOutput({
        organizationScopes: ["resources:search"],
        stackRules: [{ all: true, scopes: ["stack:read", "stack:export"] }],
        environmentRules: [{ id: awsAccess.environmentId, scopes: ["environment:read", "environment:open"] }],
    }).permissions,
});

const agent = new ps.api.agents.Definition("deploy-troubleshooter", {
    orgName: org,
    name: "loop-deploy-troubleshooter",
    displayName: "Deploy Troubleshooter",
    purpose: "When a loop-app update fails, find the root cause and propose the fix as a pull request",
    customInstructions: [
        "You are started when an update to a loop-app stack fails.",
        "1. Read the failed update's log, then read the Pulumi program in app/ of pulumi-pequod/loop-demo.",
        "2. Find the root cause: the exact line of code and why the cloud provider rejected it.",
        "3. Make the smallest change that fixes it. You may run `pulumi preview` on the failed stack to confirm the fix.",
        "4. Open ONE pull request against main. In its description give the evidence: the stack, the update number, the error message, the cause, and the preview result if you ran one.",
        "Never deploy: never run pulumi up, refresh or destroy, and never approve anything. The fix ships through the loop delivery pipeline after a person merges it.",
    ].join("\n"),
    roleId: role.roleId,
});

// Any failed update on a loop-app stack starts a task.
// Name the stacks: the pipeline's own stack records failed updates of its own, and those must not trigger it.
const STACKS = ["dev", "staging", "prod-us", "prod-eu"];
new ps.api.AgentAutomationV2("failed-update", {
    orgName: org,
    kind: "triggered",
    name: "loop-app update failed",
    trigger: {
        type: "stack_operation",
        quietPeriodSeconds: 60,
        operations: ["update"],
        results: ["failed"],
        stacks: STACKS.map(name => ({ name, routingProject: "loop-app" })),
    },
    task: {
        message: {
            type: "user_message",
            content: "A loop-app update failed. Find the root cause and open a pull request with the fix.",
        },
        approvalMode: "auto",
        agentDefinitionId: agent.definitionID,
    },
});

export const agentId = agent.definitionID;
