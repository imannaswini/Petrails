import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Pet, Assessment, Claim, NotificationItem, EvidenceItem } from '../types';
import { assessmentService } from '../services/assessmentService';
import { petService } from '../services/petService';
import { claimService } from '../services/claimService';
import { operationsService } from '../services/operationsService';
import { authService, AuthResponse } from '../services/authService';

interface AppContextType {
  pets: Pet[];
  assessments: Assessment[];
  claims: Claim[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isLoadingBackend: boolean;
  backendError: string | null;
  currentUser: AuthResponse['user'] | null;
  logoutUser: () => void;
  
  // UI States
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  
  // Modals
  requestInfoModal: {
    isOpen: boolean;
    assessmentId: string | null;
    petName: string;
    gapTitle?: string;
  };
  openRequestInfoModal: (assessmentId: string, petName: string, gapTitle?: string) => void;
  closeRequestInfoModal: () => void;
  
  evidenceViewerModal: {
    isOpen: boolean;
    evidence: EvidenceItem | null;
  };
  openEvidenceModal: (evidence: EvidenceItem) => void;
  closeEvidenceModal: () => void;
  
  // Underwriting actions
  recordUnderwriterDecision: (
    assessmentId: string,
    decision: 'Approve' | 'Request Information' | 'Refer for Review',
    notes: string,
    stipulation?: string
  ) => Promise<void>;
  
  // Claim actions
  recordClaimDecision: (
    claimId: string,
    status: 'Approved' | 'Adjusted' | 'Information Requested' | 'Referred to Senior Adjuster',
    notes: string,
    approvedAmount?: number
  ) => Promise<void>;

  // New assessment creation
  addNewAssessment: (assessment: Assessment, pet: Pet) => Promise<void>;
  
  // Notifications actions
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => void;

  // Search helper
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Refresh data from backend
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthResponse['user'] | null>(null);
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [requestInfoModal, setRequestInfoModal] = useState<{
    isOpen: boolean;
    assessmentId: string | null;
    petName: string;
    gapTitle?: string;
  }>({
    isOpen: false,
    assessmentId: null,
    petName: '',
  });

  const [evidenceViewerModal, setEvidenceViewerModal] = useState<{
    isOpen: boolean;
    evidence: EvidenceItem | null;
  }>({
    isOpen: false,
    evidence: null
  });

  // Load from live backend services on initial mount
  const refreshData = async () => {
    setIsLoadingBackend(true);
    setBackendError(null);
    try {
      const [fetchedPets, fetchedAssessments, fetchedClaims, fetchedNotifs, userProfile] = await Promise.all([
        petService.getPets().catch(() => [] as Pet[]),
        assessmentService.getAssessments().catch(() => [] as Assessment[]),
        claimService.getClaims().catch(() => [] as Claim[]),
        operationsService.getNotifications().catch(() => [] as NotificationItem[]),
        authService.getCurrentUser().catch(() => null)
      ]);

      setPets(fetchedPets || []);
      setAssessments(fetchedAssessments || []);
      setClaims(fetchedClaims || []);
      setNotifications(fetchedNotifs || []);
      setCurrentUser(userProfile);
    } catch (err: any) {
      const msg = err?.message || 'Could not load enterprise data from backend.';
      setBackendError(msg);
      console.error('[PETRAILS] Backend sync error:', err);
    } finally {
      setIsLoadingBackend(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const logoutUser = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const openRequestInfoModal = (assessmentId: string, petName: string, gapTitle?: string) => {
    setRequestInfoModal({
      isOpen: true,
      assessmentId,
      petName,
      gapTitle
    });
  };

  const closeRequestInfoModal = () => {
    setRequestInfoModal(prev => ({ ...prev, isOpen: false }));
  };

  const openEvidenceModal = (evidence: EvidenceItem) => {
    setEvidenceViewerModal({
      isOpen: true,
      evidence
    });
  };

  const closeEvidenceModal = () => {
    setEvidenceViewerModal({
      isOpen: false,
      evidence: null
    });
  };

  const recordUnderwriterDecision = async (
    assessmentId: string,
    decision: 'Approve' | 'Request Information' | 'Refer for Review',
    notes: string,
    stipulation?: string
  ) => {
    const actorName = currentUser?.fullName || 'Sarah Jenkins';

    // 1. Dispatch directly to live Backend Service (persists in MongoDB Atlas)
    const result = await assessmentService.recordDecision(assessmentId, {
      decision,
      notes,
      stipulation,
      user: actorName
    });

    if (result && result.success) {
      // 2. Update state reflecting confirmed MongoDB change
      const newHistoryEntry = result.decision;
      const updatedStatus =
        decision === 'Approve'
          ? 'Approved'
          : decision === 'Request Information'
          ? 'Information Requested'
          : 'Referred';

      setAssessments(prev =>
        prev.map(asm => {
          if (asm.id !== assessmentId) return asm;

          const currentStipulations = asm.underwriterDecision?.stipulations || [];
          const updatedStipulations = stipulation
            ? [...currentStipulations, stipulation]
            : currentStipulations;

          return {
            ...asm,
            status: updatedStatus as Assessment['status'],
            lastUpdated: 'Just now',
            underwriterDecision: {
              recommendation: asm.riskLevel,
              selectedDecision: decision,
              underwriterNotes: notes,
              stipulations: updatedStipulations,
              lastModifiedBy: actorName,
              lastModifiedAt: 'Just now'
            },
            decisionHistory: [newHistoryEntry, ...(asm.decisionHistory || [])]
          };
        })
      );

      // Update pet policy status in memory if approved
      if (decision === 'Approve') {
        const matchingAsm = assessments.find(a => a.id === assessmentId);
        if (matchingAsm) {
          setPets(prev =>
            prev.map(p =>
              p.id === matchingAsm.petId
                ? { ...p, policyStatus: 'Active' as const }
                : p
            )
          );
        }
      }

      // Record notification
      const currentAsm = assessments.find(a => a.id === assessmentId);
      const notifItem: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: `Decision recorded for ${currentAsm?.petName || 'Application'}`,
        description: `${actorName} recorded: ${decision}. Audit log updated.`,
        timestamp: 'Just now',
        read: false,
        priority: 'medium',
        link: `/assessments/${assessmentId}`,
        type: 'assessment'
      };
      setNotifications(prev => [notifItem, ...prev]);
      operationsService.createNotification(notifItem).catch(console.warn);
    }
  };

  const recordClaimDecision = async (
    claimId: string,
    status: 'Approved' | 'Adjusted' | 'Information Requested' | 'Referred to Senior Adjuster',
    notes: string,
    approvedAmount?: number
  ) => {
    const actorName = currentUser?.fullName || 'Sarah Jenkins (Senior Underwriting & Claims Officer)';

    // 1. Dispatch to live Backend Service (persists in MongoDB Atlas)
    const result = await claimService.recordDecision(claimId, {
      status,
      notes,
      approvedAmountInr: approvedAmount,
      decidedBy: actorName
    });

    if (result && result.success) {
      // 2. Update state reflecting confirmed MongoDB update
      const finalStatus =
        status === 'Approved' || status === 'Adjusted'
          ? 'Approved'
          : status === 'Information Requested'
          ? 'Under Review'
          : 'Attention Required';

      setClaims(prev =>
        prev.map(c => {
          if (c.id !== claimId) return c;
          return {
            ...c,
            status: finalStatus as Claim['status'],
            adjusterDecision: result.decision
          };
        })
      );
    }
  };

  const addNewAssessment = async (newAsm: Assessment, newPet: Pet) => {
    // 1. Dispatch directly to live Backend Services (persists in MongoDB Atlas)
    const savedPet = await petService.createPet(newPet);
    const savedAsm = await assessmentService.createAssessment(newAsm);

    // 2. Add confirmed persisted records to frontend state
    setAssessments(prev => [savedAsm || newAsm, ...prev]);
    setPets(prev => [savedPet || newPet, ...prev]);

    const notifItem: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: `New Risk Assessment run for ${newPet.name}`,
      description: `Automated Rule Engine (${newAsm.ruleScore}) and ML Model (${newAsm.mlScore}) generated risk score ${newAsm.combinedScore}.`,
      timestamp: 'Just now',
      read: false,
      priority: 'high',
      link: `/assessments/${newAsm.id}`,
      type: 'assessment'
    };
    setNotifications(prev => [notifItem, ...prev]);
    operationsService.createNotification(notifItem).catch(console.warn);
  };

  const markNotificationAsRead = async (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    operationsService.markNotificationRead(id).catch(console.warn);
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        pets,
        assessments,
        claims,
        notifications,
        unreadNotificationCount,
        isLoadingBackend,
        backendError,
        currentUser,
        logoutUser,
        isSearchOpen,
        setIsSearchOpen,
        isNotificationsOpen,
        setIsNotificationsOpen,
        requestInfoModal,
        openRequestInfoModal,
        closeRequestInfoModal,
        evidenceViewerModal,
        openEvidenceModal,
        closeEvidenceModal,
        recordUnderwriterDecision,
        recordClaimDecision,
        addNewAssessment,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        searchQuery,
        setSearchQuery,
        refreshData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
