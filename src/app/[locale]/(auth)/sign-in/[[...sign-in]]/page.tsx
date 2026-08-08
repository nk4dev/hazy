import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        variables: {
          colorPrimary: "#9184d9",
          colorBackground: "#161826",
          borderRadius: "8px",
        },
      }}
    />
  );
}
