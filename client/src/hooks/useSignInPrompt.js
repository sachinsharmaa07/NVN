import { useContext } from "react";
import { SignInPromptContext } from "@/components/auth/signInPromptContext";

export function useSignInPrompt() {
  return useContext(SignInPromptContext);
}
