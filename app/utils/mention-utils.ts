type MentionTargetUser = {
  id: string
  name: string
  email: string
  department?: string | null
}

type MentionTargetGroup = {
  id: string
  name: string
  memberCount?: number | null
}

const encodeMetadata = (value: Record<string, unknown>) => {
  const json = JSON.stringify(value)
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(json)))
  }
  return Buffer.from(json, 'utf-8').toString('base64')
}

export const buildTargetUserTag = (user: MentionTargetUser) => {
  const meta = {
    targetUserResourceId: user.id,
    fullName: user.name,
    email: user.email,
    department: user.department ?? ''
  }
  const encoded = encodeMetadata(meta)
  return `::ui:target_user::${encoded}::/ui:target_user::`
}

export const buildTargetGroupTag = (group: MentionTargetGroup) => {
  const meta = {
    targetGroupResourceId: group.id,
    groupName: group.name,
    memberCount: group.memberCount ?? 0
  }
  const encoded = encodeMetadata(meta)
  return `::ui:target_group::${encoded}::/ui:target_group::`
}

export const getEmailInitials = (email: string) => {
  const localPart = email.split('@')[0] ?? ''
  const segments = localPart.split(/[^a-zA-Z0-9]+/).filter(Boolean)
  const initials = segments.map((segment) => segment[0]).join('').slice(0, 2)
  return (initials || localPart.slice(0, 2) || email.slice(0, 2)).toUpperCase()
}

export const getNameInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.map((part) => part[0]).join('').slice(0, 2)
  return (initials || name.slice(0, 2)).toUpperCase()
}
