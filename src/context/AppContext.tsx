import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Pet, Assessment, CreateAssessmentPayload, UpdateAssessmentPayload, Claim, NotificationItem, EvidenceItem } from '../types';
import { assessmentService, InformationRequestPayload } from '../services/assessmentService';
import { petService } from '../services/petService';
import { claimService } from '../services/claimService';
import { operationsService } from '../services/operationsService';
import { authService, AuthResponse } from '../services/authService';

function normalizeAndSortAssessments(items: Assessment[]): Assessment[] {
  const deduped = new Map<string, Assessment>();
  for (const item of items) {
    if (item && item.id) {
      deduped.set(item.id, item);
    }
  }
  return Array.from(deduped.values()).sort((a, b) => {
    const timeA = Date.parse(a.updatedAt || a.createdAt || a.lastUpdated || '') || 0;
    const timeB = Date.parse(b.updatedAt || b.createdAt || b.lastUpdated || '') || 0;
    return timeB - timeA;
  });
}

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

  requestAssessmentInformation: (
    assessmentId: string,
    payload: InformationRequestPayload
  ) => Promise<void>;
  
  // Claim actions
  recordClaimDecision: (
    claimId: string,
    status: 'Approved' | 'Adjusted' | 'Information Requested' | 'Referred to Senior Adjuster',
    notes: string,
    approvedAmount?: number
  ) => Promise<void>;

  // New assessment creation, update & archival
  addNewAssessment: (assessment: CreateAssessmentPayload, pet: Pet) => Promise<Assessment>;
  updateAssessment: (assessmentId: string, payload: UpdateAssessmentPayload) => Promise<Assessment>;
  deleteAssessment: (assessmentId: string) => Promise<void>;
  
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

  // Load authorized user data from live backend services
  const refreshData = useCallback(async () => {
    const token = localStorage.getItem('petrails_auth_token');
    if (!token) {
      setPets([]);
      setAssessments([]);
      setClaims([]);
      setNotifications([]);
      setCurrentUser(null);
      setBackendError(null);
      setIsLoadingBackend(false);
      return;
    }

    setIsLoadingBackend(true);
    setBackendError(null);
    try {
      const userProfile = await authService.getCurrentUser();
      if (!userProfile) {
        setPets([]);
        setAssessments([]);
        setClaims([]);
        setNotifications([]);
        setCurrentUser(null);
        return;
      }

      const [fetchedPets, fetchedAssessments, fetchedClaims, fetchedNotifs] = await Promise.all([
        petService.getPets().catch(() => [] as Pet[]),
        assessmentService.getAssessments(),
        claimService.getClaims().catch(() => [] as Claim[]),
        operationsService.getNotifications().catch(() => [] as NotificationItem[])
      ]);

      setCurrentUser(userProfile);
      setPets(fetchedPets || []);
      setAssessments(normalizeAndSortAssessments(fetchedAssessments || []));
      setClaims(fetchedClaims || []);
      setNotifications(fetchedNotifs || []);
    } catch (err: any) {
      const msg = err?.message || 'Could not load enterprise data from backend.';
      setBackendError(msg);
      console.error('[PETRAILS] Backend sync error:', err);
    } finally {
      setIsLoadingBackend(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const handleWindowFocus = () => {
      if (localStorage.getItem('petrails_auth_token')) {
        assessmentService
          .getAssessments()
          .then(items => setAssessments(normalizeAndSortAssessments(items || [])))
          .catch(() => {});
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [refreshData]);

  const logoutUser = () => {
    authService.logout();
    setCurrentUser(null);
    setPets([]);
    setAssessments([]);
    setClaims([]);
    setNotifications([]);
    setBackendError(null);
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
    const actorName = currentUser?.fullName || currentUser?.email || 'Authenticated User';

    // 1. Dispatch directly to live Backend Service (identity derived from JWT on backend)
    const result = await assessmentService.recordDecision(assessmentId, {
      decision,
      notes,
      stipulation
    });

    if (result && result.success) {
      // 2. Sync state immediately from authoritative backend assessment record
      const updatedAssessment =
        result.assessment || (await assessmentService.getAssessmentById(assessmentId));

      setAssessments(prev =>
        normalizeAndSortAssessments([
          updatedAssessment,
          ...prev.filter(a => a.id !== assessmentId)
        ])
      );

      // Update pet policy status in memory if approved
      if (decision === 'Approve' && updatedAssessment?.petId) {
        setPets(prev =>
          prev.map(p =>
            p.id === updatedAssessment.petId
              ? { ...p, policyStatus: 'Active' as const }
              : p
          )
        );
      }

      // Background query invalidation to guarantee list parity
      assessmentService
        .getAssessments()
        .then(items => setAssessments(normalizeAndSortAssessments(items || [])))
        .catch(() => {});

      const notifItem: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: `Decision recorded for ${updatedAssessment?.petName || 'Application'}`,
        description: `${result.decision?.user || actorName} recorded: ${decision}. Audit log updated.`,
        timestamp: result.decision?.timestamp || new Date().toISOString(),
        read: false,
        priority: 'medium',
        link: `/assessments/${assessmentId}`,
        type: 'assessment'
      };
      setNotifications(prev => [notifItem, ...prev]);
      operationsService.createNotification(notifItem).catch(console.warn);
    }
  };

  const requestAssessmentInformation = async (
    assessmentId: string,
    payload: InformationRequestPayload
  ) => {
    const result = await assessmentService.requestInformation(assessmentId, payload);
    if (result && result.success) {
      const updatedAssessment =
        result.assessment || (await assessmentService.getAssessmentById(assessmentId));

      setAssessments(prev =>
        normalizeAndSortAssessments([
          updatedAssessment,
          ...prev.filter(a => a.id !== assessmentId)
        ])
      );

      assessmentService
        .getAssessments()
        .then(items => setAssessments(normalizeAndSortAssessments(items || [])))
        .catch(() => {});

      const notifItem: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: `Information requested for ${updatedAssessment?.petName || 'Application'}`,
        description: result.message || `Questionnaire dispatched to ${payload.recipient}.`,
        timestamp: result.dispatchedAt || new Date().toISOString(),
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
    const actorName = currentUser?.fullName || currentUser?.email || 'Authenticated Claims Officer';

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

  const addNewAssessment = async (
    newAsm: CreateAssessmentPayload,
    newPet: Pet
  ): Promise<Assessment> => {
    // 1. Dispatch directly to live Backend Services (persists in MongoDB Atlas)
    const savedPet = await petService.createPet(newPet);
    let savedAsm: Assessment;
    try {
      savedAsm = await assessmentService.createAssessment({ ...newAsm, petId: savedPet.id });
    } catch (error) {
      // A timed-out POST may have committed; only compensate if no linked assessment exists.
      const linkedAssessments = await assessmentService.getAssessments().catch(() => []);
      if (!linkedAssessments.some(item => item.petId === savedPet.id)) {
        await petService.deletePet(savedPet.id).catch(() => undefined);
      }
      throw error;
    }

    const finalPet: Pet = {
      ...savedPet,
      riskLevel: savedAsm.riskLevel,
      riskScore: savedAsm.combinedScore
    };

    // 2. Immediately prepend authoritative backend record & refetch to ensure real-time sync
    setAssessments(prev =>
      normalizeAndSortAssessments([savedAsm, ...prev.filter(a => a.id !== savedAsm.id)])
    );
    setPets(prev => [finalPet, ...prev.filter(p => p.id !== finalPet.id)]);

    assessmentService
      .getAssessments()
      .then(items => setAssessments(normalizeAndSortAssessments(items || [])))
      .catch(() => {});

    const notifItem: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: `New Risk Assessment run for ${savedAsm.petName}`,
      description: `Automated Rule Engine (${savedAsm.ruleScore}) and ML Model (${savedAsm.mlScore}) generated risk score ${savedAsm.combinedScore}.`,
      timestamp: savedAsm.createdAt || new Date().toISOString(),
      read: false,
      priority: 'high',
      link: `/assessments/${savedAsm.id}`,
      type: 'assessment'
    };
    setNotifications(prev => [notifItem, ...prev]);
    operationsService.createNotification(notifItem).catch(console.warn);

    return savedAsm;
  };

  const updateAssessment = async (
    assessmentId: string,
    payload: UpdateAssessmentPayload
  ): Promise<Assessment> => {
    const updatedAsm = await assessmentService.updateAssessment(assessmentId, payload);

    setAssessments(prev =>
      normalizeAndSortAssessments([
        updatedAsm,
        ...prev.filter(a => a.id !== assessmentId)
      ])
    );

    if (updatedAsm.petId) {
      petService
        .getPetById(updatedAsm.petId)
        .then(updatedPet => {
          setPets(prev => [updatedPet, ...prev.filter(p => p.id !== updatedPet.id)]);
        })
        .catch(() => {});
    }

    assessmentService
      .getAssessments()
      .then(items => setAssessments(normalizeAndSortAssessments(items || [])))
      .catch(() => {});

    const notifItem: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: `Assessment reassessed for ${updatedAsm.petName}`,
      description: `Updated inputs recalculated Rule (${updatedAsm.ruleScore}) and ML (${updatedAsm.mlScore}) scores -> ${updatedAsm.combinedScore} (${updatedAsm.riskLevel}).`,
      timestamp: updatedAsm.updatedAt || new Date().toISOString(),
      read: false,
      priority: updatedAsm.riskLevel === 'HIGH' ? 'high' : 'medium',
      link: `/assessments/${updatedAsm.id}`,
      type: 'assessment'
    };
    setNotifications(prev => [notifItem, ...prev]);
    operationsService.createNotification(notifItem).catch(console.warn);

    return updatedAsm;
  };

  const deleteAssessment = async (assessmentId: string): Promise<void> => {
    const targetAsm = assessments.find(a => a.id === assessmentId);
    const res = await assessmentService.deleteAssessment(assessmentId);

    setAssessments(prev => prev.filter(a => a.id !== assessmentId));

    assessmentService
      .getAssessments()
      .then(items => setAssessments(normalizeAndSortAssessments(items || [])))
      .catch(() => {});

    if (targetAsm) {
      const notifItem: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: `Assessment archived for ${targetAsm.petName}`,
        description: `Dossier ${assessmentId} archived. Linked pet record and audit history preserved.`,
        timestamp: res.archivedAt || new Date().toISOString(),
        read: false,
        priority: 'medium',
        link: '/assessments',
        type: 'assessment'
      };
      setNotifications(prev => [notifItem, ...prev]);
      operationsService.createNotification(notifItem).catch(console.warn);
    }
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
        requestAssessmentInformation,
        recordClaimDecision,
        addNewAssessment,
        updateAssessment,
        deleteAssessment,
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
