import { apiClient } from './apiClient';
import { Pet } from '../types';

export const petService = {
  async getPets(): Promise<Pet[]> {
    return apiClient.get<Pet[]>('/pets');
  },

  async getPetById(id: string): Promise<Pet> {
    return apiClient.get<Pet>(`/pets/${id}`);
  },

  async createPet(pet: Pet): Promise<Pet> {
    return apiClient.post<Pet>('/pets', pet);
  },

  async deletePet(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/pets/${id}`);
  }
};
