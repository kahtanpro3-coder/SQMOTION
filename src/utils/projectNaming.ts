import { Project, Language } from '../types';

/**
 * Generates the next sequential project name starting from "مشروع 1" (or "Project 1") to infinity.
 * Analyzes existing saved projects to find the next available sequential number.
 */
export function getNextProjectName(
  existingProjects: Project[] = [],
  lang: Language = 'ar'
): string {
  const prefix = lang === 'ar' ? 'مشروع' : 'Project';

  const existingNamesLower = new Set(
    existingProjects.map((p) => (p?.settings?.name || '').trim().toLowerCase())
  );

  let maxNum = 0;

  existingProjects.forEach((p) => {
    const name = (p?.settings?.name || '').trim();
    // Match either Arabic "مشروع 1" or English "Project 1"
    const match = name.match(/^(?:مشروع|project)\s+(\d+)$/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  // Calculate next number starting from 1
  let nextNum = maxNum > 0 ? maxNum + 1 : 1;

  // Ensure no collision if a project already has this exact name
  while (
    existingNamesLower.has(`مشروع ${nextNum}`.toLowerCase()) ||
    existingNamesLower.has(`project ${nextNum}`.toLowerCase())
  ) {
    nextNum++;
  }

  return `${prefix} ${nextNum}`;
}
