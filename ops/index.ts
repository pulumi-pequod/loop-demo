import * as pulumi from "@pulumi/pulumi";
import * as ps from "@pulumi/pulumiservice";

const org = pulumi.getOrganization();

// Least privilege: the agent can read stacks. It cannot deploy or approve.
const role = new ps.OrganizationRole("loop-hygiene-agent-role", {
    organizationName: org,
    name: "loop-hygiene-agent",
    description: "Read every stack. No deploy, no approve.",
    permissions: ps.buildRolePermissionsOutput({
        stackRules: [{ all: true, scopes: ["stack:read"] }],
    }).permissions,
});

const agent = new ps.api.agents.Definition("hygiene-reviewer", {
    orgName: org,
    name: "loop-hygiene-reviewer",
    displayName: "Hygiene Reviewer",
    purpose: "Review loop-app stacks for cost and hygiene problems and propose fixes as pull requests",
    customInstructions: [
        "Review the loop-app stacks (dev, staging, prod).",
        "Look for CloudWatch log groups with no retention, untagged resources and oversized settings.",
        "For each real problem, change the Pulumi program in app/ and open ONE pull request",
        "with the fix, the evidence (stack, resource, current value) and the expected preview.",
        "Never deploy. Changes ship through the loop delivery pipeline.",
    ].join("\n"),
    roleId: role.roleId,
});

// Weekly review. For recording, use "Run now" on this automation in the console.
new ps.api.AgentAutomationV2("weekly-hygiene", {
    orgName: org,
    kind: "scheduled",
    name: "loop-weekly-hygiene-review",
    scheduleCron: "0 9 * * 1",
    task: {
        message: { type: "user_message", content: "Run your weekly hygiene review of loop-app." },
        agentDefinitionId: agent.definitionID,
    },
});

export const agentId = agent.definitionID;
