import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@whsf/aurora-ui";
const meta = { title: "Aurora/Button", component: Button, tags: ["autodocs"], args: { children: "Continue" } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { tone: "secondary" } };
export const Danger: Story = { args: { tone: "danger", children: "Remove access" } };
