export type Platform = "facebook" | "google" | "instagram" | "linkedin" | "twitter" | "tiktok" | "other"
export type AdType = "image" | "video" | "text" | "carousel" | "other"
export type AlertType = "new_campaign" | "ad_change" | "spend_increase" | "spend_decrease" | "new_platform" | "other"

export interface AdAnalysis {
  emotion?: string
  targetAudience?: string
  product?: string
  strategy?: string
  promotion?: string
  tone?: string
  callToAction?: string
  message?: string
  transcription?: string
  rawAnalysis?: string
}

export interface AlertData {
  competitorId: number
  businessId?: number
  type: AlertType
  title: string
  description: string
  isImportant?: boolean
}

export interface CompetitorData {
  id: number
  name: string
  website: string
  industry: string
  notes?: string
  trackFacebook: boolean
  trackGoogle: boolean
  trackInstagram: boolean
  trackLinkedIn: boolean
  lastScraped?: Date
  createdAt: Date
  updatedAt: Date
}

export interface AdData {
  id: number
  competitorId: number
  platform: Platform
  type: AdType
  content: string
  mediaUrl?: string
  landingPage?: string
  firstSeen: Date
  lastSeen: Date
  isActive: boolean
  aiAnalysis?: AdAnalysis
  createdAt: Date
  updatedAt: Date
}

export interface BusinessData {
  id: number
  userId: string
  name: string
  industry: string
  location?: string
  keywords: string
  knownCompetitors?: string
  createdAt: Date
  updatedAt: Date
}

export interface UserPreferencesData {
  id: number
  userId: string
  theme: string
  emailNotifications: boolean
  inAppNotifications: boolean
  scrapingFrequency: number
  dataRetentionDays: number
  createdAt: Date
  updatedAt: Date
}

export interface InsightData {
  id: number
  businessId: number
  title: string
  description: string
  recommendation: string
  isApplied: boolean
  createdAt: Date
}

export interface AlertResponseData {
  id: number
  businessId: number
  competitorId: number
  type: AlertType
  title: string
  description: string
  isRead: boolean
  isImportant: boolean
  createdAt: Date
}

export interface ScrapingResult {
  success: boolean
  competitorId: number
  error?: string
  results?: Record<Platform, ScrapedAd[]>
}

export interface ScrapedAd {
  type: string | AdType
  content: string
  mediaUrl?: string
  landingPage?: string
  firstSeen: string
  isActive: boolean
}

export interface CompetitorDiscoveryResult {
  name: string
  website: string
  industry: string
}

export interface DiscoveryResponse {
  success: boolean
  newCompetitors: CompetitorData[]
  total: number
}

export interface ChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}
