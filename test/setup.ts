// Vitest setup. Provide shims for server-only sentinel modules.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
