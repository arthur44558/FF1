import React from "react";
import { useAuth } from "../../context/AuthContext";
import type { Role } from "../../types/api";

interface RoleGuardProps {
  roles?: Role | Role[];
  permissions?: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  roles,
  permissions,
  children,
  fallback = null,
}) => {
  const { user, hasRole, hasPermission } = useAuth();

  if (!user) return <>{fallback}</>;

  if (roles && !hasRole(roles)) {
    return <>{fallback}</>;
  }

  if (permissions) {
    const permList = Array.isArray(permissions) ? permissions : [permissions];
    const hasAll = permList.every((p) => hasPermission(p));
    if (!hasAll) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};
