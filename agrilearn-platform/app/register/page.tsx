import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">AgriLearn AI</Link>
        <p className="eyebrow">Start learning</p>
        <h1>Create your AgriLearn account</h1>
        <p className="auth-intro">
          Join a practical learning platform designed to help farmers, students, and agricultural professionals build useful skills.
        </p>
        <AuthForm mode="register" />
      </section>
    </main>
  );
}
