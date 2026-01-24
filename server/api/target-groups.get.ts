import { createError, getHeader, getQuery } from 'h3'

type TargetGroup = {
  resourceId: string
  name: string
  userCount?: number | null
}

type TargetGroupsResponse = {
  data?: {
    results?: TargetGroup[]
  }
}

type MentionGroup = {
  id: string
  name: string
  memberCount?: number
}

const normalize = (value: string) => value.trim().toLowerCase()

const parseLimit = (value: unknown, fallback = 8) => {
  if (typeof value !== 'string') {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(Math.max(parsed, 1), 20)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? normalize(query.q) : ''
  const limit = parseLimit(query.limit, 8)
  const baseApiUrl = typeof query.baseApiUrl === 'string' ? query.baseApiUrl.trim() : ''

  if (!q || q.length < 3) {
    return []
  }

  if (!baseApiUrl) {
    throw createError({ statusCode: 400, statusMessage: 'baseApiUrl is required' })
  }

  const authorization = getHeader(event, 'authorization')
  if (!authorization) {
    throw createError({ statusCode: 401, statusMessage: 'Authorization required' })
  }

  const companyId =
    (typeof query.companyId === 'string' ? query.companyId.trim() : '') ||
    (getHeader(event, 'x-company-id') ?? '')

  const targetGroupsUrl = `${baseApiUrl.replace(/\/+$/, '')}/api/target-groups/search`

  const payload = {
    pageNumber: 1,
    pageSize: limit,
    orderBy: 'CreateTime',
    ascending: false,
    filter: {
      Condition: 'AND',
      SearchInputTextValue: '',
      FilterGroups: [
        {
          Condition: 'AND',
          FilterItems: [
            {
              Value: q,
              FieldName: 'name',
              Operator: 'Contains'
            }
          ],
          FilterGroups: []
        },
        {
          Condition: 'OR',
          FilterItems: [],
          FilterGroups: []
        }
      ]
    },
    systemGeneratedGroups: true
  }

  const response = await $fetch<TargetGroupsResponse>(targetGroupsUrl, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(companyId ? { 'X-COMPANY-ID': companyId } : {})
    },
    body: payload
  })

  const results = response.data?.results ?? []
  return results.map((group) => {
    return {
      id: group.resourceId,
      name: group.name,
      memberCount: group.userCount ?? 0
    } satisfies MentionGroup
  })
})
