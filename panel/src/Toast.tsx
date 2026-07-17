/**
 * Toast.tsx — 顶部右侧通知
 */

import { Box, Text } from "ink";
import { useStore } from "./store.js";
import { T } from "./theme.js";

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  const color = toast.kind === "success" ? T.green : toast.kind === "error" ? T.red : toast.kind === "warning" ? T.yellow : T.blue;
  return (
    <Box position="absolute" top={1} right={1} backgroundColor={color} paddingX={1}>
      <Text color={T.bg} bold>
        {toast.msg}
      </Text>
    </Box>
  );
}
