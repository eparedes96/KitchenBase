import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { PublicOnlyRoute } from "@/components/routing/PublicOnlyRoute";
import { AppLayout } from "@/components/layout/AppLayout";

// Auth screens
import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import RegisterScreen from "@/screens/auth/RegisterScreen";

// App screens (placeholders for now)
import HomeScreen from "@/screens/HomeScreen";
import PantryScreen from "@/screens/PantryScreen";
import MyRecipesScreen from "@/screens/MyRecipesScreen";
import LibraryScreen from "@/screens/LibraryScreen";
import ShoppingListScreen from "@/screens/ShoppingListScreen";
import DiscoverScreen from "@/screens/DiscoverScreen";
import SettingsScreen from "@/screens/SettingsScreen";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public-only routes */}
            <Route
              path="/welcome"
              element={
                <PublicOnlyRoute>
                  <WelcomeScreen />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginScreen />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <RegisterScreen />
                </PublicOnlyRoute>
              }
            />

            {/* Protected routes (TopBar + BottomTabBar) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeScreen />} />
              <Route path="/pantry" element={<PantryScreen />} />
              <Route path="/my-recipes" element={<MyRecipesScreen />} />
              <Route path="/library" element={<LibraryScreen />} />
              <Route path="/shopping-list" element={<ShoppingListScreen />} />
              <Route path="/discover" element={<DiscoverScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
