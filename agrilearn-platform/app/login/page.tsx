import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">AgriLearn AI</Link>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to continue learning</h1>
        <p className="auth-intro">Access your courses, farm guidance, saved conversations, and learning progress.</p>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
