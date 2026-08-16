import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

export interface Organization {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface OrganizationContextType {
  selectedOrg: string;
  setSelectedOrg: (orgId: string) => void;
  organizations: Organization[];
  isLoadingOrgs: boolean;
  refetchOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  selectedOrg: 'BHEL',
  setSelectedOrg: () => {},
  organizations: [
    { id: 'BHEL', name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
    { id: 'METLIFE', name: 'METLIFE', code: 'METLIFE', status: 'ACTIVE' },
  ],
  isLoadingOrgs: false,
  refetchOrganizations: async () => {},
});

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedOrg, setSelectedOrgState] = useState<string>(() => {
    return localStorage.getItem('selected_organization') || 'BHEL';
  });

  const [organizations, setOrganizations] = useState<Organization[]>([
    { id: 'BHEL', name: 'BHEL', code: 'BHEL', status: 'ACTIVE' },
    { id: 'METLIFE', name: 'METLIFE', code: 'METLIFE', status: 'ACTIVE' },
  ]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState<boolean>(false);

  const setSelectedOrg = (orgId: string) => {
    if (!orgId || !orgId.trim()) return;
    const cleanOrg = orgId.trim();
    setSelectedOrgState(cleanOrg);
    localStorage.setItem('selected_organization', cleanOrg);
    window.location.reload();
  };

  const refetchOrganizations = async () => {
    setIsLoadingOrgs(true);
    try {
      const response = await api.get('/organizations');
      if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        setOrganizations(response.data.data);
      }
    } catch (err) {
      // Fallback default BHEL
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  useEffect(() => {
    refetchOrganizations();
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrg,
        setSelectedOrg,
        organizations,
        isLoadingOrgs,
        refetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);
