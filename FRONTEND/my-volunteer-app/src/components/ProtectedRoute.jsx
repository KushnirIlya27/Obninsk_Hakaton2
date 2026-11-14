import { Fragment } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Loading, ResourceError } from "./ui";
export default function ProtectedRoute({ coordinator = false, children }) {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <Loading />;
  if (error)
    return (
      <main className="max-w-2xl p-8 mx-auto">
        <ResourceError error={error} retry={() => refresh().catch(() => {})} />
      </main>
    );
  if (!user)
    return (
      <Navigate
        to={coordinator ? "/login?role=coordinator" : "/login"}
        replace
      />
    );
  if (coordinator && !user.can_review)
    return <Navigate to="/dashboard" replace />;
  return <Fragment key={user.id}>{children}</Fragment>;
}
