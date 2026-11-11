export type CompetitionStatus = 'draft' | 'published' | 'offline'
export type RegistrationStatus = 'pending' | 'confirmed' | 'rejected'

export interface Competition {
  id: string
  title: string
  summary: string
  rules: string
  /** ISO 8601 带时区；报名是否截止由该时间与当前时间比较，不与发布状态混同 */
  registrationDeadline: string
  status: CompetitionStatus
  createdAt: string
  updatedAt: string
}

export interface Registration {
  id: string
  competitionId: string
  name: string
  email: string
  status: RegistrationStatus
  createdAt: string
}

/** The public list omits private management fields and only contains published competitions. */
export type PublicCompetition = Pick<Competition, 'id' | 'title' | 'summary' | 'registrationDeadline'> & {
  status: 'published'
  registrationOpen?: boolean
}
export type PublicCompetitionDetail = PublicCompetition & Pick<Competition, 'rules'>
export type RegistrationInput = Pick<Registration, 'name' | 'email'>
export type RegistrationReceipt = Pick<Registration, 'id' | 'competitionId' | 'createdAt'> & { status: 'pending' }
