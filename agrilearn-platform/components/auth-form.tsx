"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthFormProps = {
  mode: "login" | "register";
};

function friendlyError(message: string) {
  if (message.includes("invalid-credential")) return "The email address or password is incorrect.";
  if (message.includes("email-already-in-use")) return "An account already exists for this email address.";
  if (message.includes("weak-password")) return "Please choose a password with at least six characters.";
  if (message.includes("invalid-email")) return "Please enter a valid email address.";
  return "We could not complete your request. Please try again.";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace("/dashboard");
    } catch (caughtError) {
      setError(friendlyError(caughtError instanceof Error ? caughtError.message : ""));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isRegister && (
        <label>
          Full name
          <input autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      )}
      <label>
        Email address
        <input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input autoComplete={isRegister ? "new-password" : "current-password"} type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button auth-submit" disabled={submitting} type="submit">
        {submitting ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </button>
      <p className="auth-switch">
        {isRegister ? "Already have an account?" : "New to AgriLearn AI?"}{" "}
        <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
      </p>
    </form>
  );
}
