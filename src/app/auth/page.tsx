import Header from "@/components/Header";
import AuthForm from "@/components/AuthForm";

export default function AuthPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <>
      <Header />
      <main className="flex justify-center px-7 py-11">
        <AuthForm next={searchParams.next} />
      </main>
    </>
  );
}
