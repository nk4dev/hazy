import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
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
