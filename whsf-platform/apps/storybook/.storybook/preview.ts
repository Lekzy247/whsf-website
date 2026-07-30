import type { Preview } from "@storybook/nextjs-vite";
import "@whsf/aurora-ui/styles.css";
const preview: Preview = {
  parameters: { a11y: { test: "error" }, layout: "centered" },
};
export default preview;
