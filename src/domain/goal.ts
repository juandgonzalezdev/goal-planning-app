export const GOAL_NAME_MAX_LENGTH = 60
export const GOAL_DESCRIPTION_MAX_LENGTH = 200

/** A goal's name and optional description, already trimmed. */
export interface GoalDetails {
  name: string
  /** Empty when the user gave no description. */
  description: string
}

export type GoalDetailsError = 'name-required' | 'name-too-long' | 'description-too-long'

export type GoalDetailsValidation =
  | { status: 'valid'; details: GoalDetails }
  | { status: 'invalid'; errors: GoalDetailsError[] }

/**
 * Counts characters as a person sees them, so 'ł' or an emoji counts as one
 * (plain `.length` counts some of them as two).
 */
export const characterCount = (text: string) => Array.from(text).length

export function validateGoalDetails(name: string, description: string): GoalDetailsValidation {
  const details = { name: name.trim(), description: description.trim() }
  const errors: GoalDetailsError[] = []
  if (details.name === '') errors.push('name-required')
  else if (characterCount(details.name) > GOAL_NAME_MAX_LENGTH) errors.push('name-too-long')
  if (characterCount(details.description) > GOAL_DESCRIPTION_MAX_LENGTH) errors.push('description-too-long')
  return errors.length === 0 ? { status: 'valid', details } : { status: 'invalid', errors }
}
