import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";

/**
 * PublicOnlyRoute — renders children only when the user is NOT authenticated.
 * Authenticated users are sent to the home screen.
 */
export function PublicOnlyRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (session) {
    return <Navigate to="/" replace />;
  }

  return children;
}
