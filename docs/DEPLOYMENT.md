# Deployment Guide - Policy Files Feature

## Overview
Bu dokümantasyon, policy files özelliğini remote Cloudflare Pages'e deploy etmek için gerekli adımları içerir.

## Prerequisites
- Cloudflare hesabı ve Wrangler CLI kurulu
- D1 database oluşturulmuş
- R2 bucket oluşturulmuş (veya oluşturulacak)

## Deployment Steps

### 1. D1 Database Migration (Remote)

Remote D1 database'e migration'ı apply et:

```bash
wrangler d1 migrations apply agentic-ally-db --remote
```

Bu komut `server/database/migrations/0001_add_policies.sql` dosyasını remote database'e uygular.

**Kontrol:**
```bash
wrangler d1 execute agentic-ally-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='policies';"
```

### 2. R2 Bucket Oluşturma

Eğer bucket henüz oluşturulmadıysa:

```bash
wrangler r2 bucket create agentic-ally-policies
```

**Kontrol:**
```bash
wrangler r2 bucket list
```

### 3. Environment Variables (Secrets)

Production için gerekli secrets'ları set et:

```bash
# Session password (wrangler.jsonc'de vars olarak tanımlı, ama production'da secret olarak set edilmeli)
wrangler secret put NUXT_SESSION_PASSWORD

# Fleet Agent URL (wrangler.jsonc'de vars olarak tanımlı, production'da secret olarak set edilmeli)
wrangler secret put FLEET_AGENT_URL
```

**Not:** `wrangler.jsonc` içindeki `vars` local development için. Production'da `wrangler secret put` kullan.

### 4. Wrangler Configuration Kontrolü

`wrangler.jsonc` dosyasında şunların olduğundan emin ol:

```jsonc
{
  "d1_databases": [
    {
      "binding": "db",
      "database_name": "agentic-ally-db",
      "database_id": "24eae270-5b19-4e10-830a-e63bada6376e",
      "migrations_dir": "server/database/migrations"
    }
  ],
  "r2_buckets": [
    {
      "binding": "POLICIES_BUCKET",
      "bucket_name": "agentic-ally-policies"
    }
  ]
}
```

### 5. Build ve Deploy

#### Option A: Cloudflare Pages (Recommended)

Eğer Cloudflare Pages kullanıyorsan:

```bash
# Build
npm run build

# Deploy (Cloudflare Pages CLI ile)
npx wrangler pages deploy dist
```

Veya GitHub Actions / CI/CD pipeline ile otomatik deploy.

#### Option B: Wrangler Deploy (Worker olarak)

Eğer Worker olarak deploy ediyorsan:

```bash
npm run build
wrangler deploy
```

### 6. Post-Deployment Verification

#### 6.1 Database Kontrolü

```bash
# Policies table'ın var olduğunu kontrol et
wrangler d1 execute agentic-ally-db --remote --command "SELECT COUNT(*) as count FROM policies;"
```

#### 6.2 R2 Bucket Kontrolü

```bash
# Bucket'in var olduğunu kontrol et
wrangler r2 bucket list | grep agentic-ally-policies
```

#### 6.3 API Endpoint Testleri

**List Policies:**
```bash
curl -X GET "https://your-domain.com/api/files" \
  -H "X-AGENTIC-ALLY-TOKEN: YOUR_TOKEN" \
  -H "X-COMPANY-ID: YOUR_COMPANY_ID"
```

**Upload Policy:**
```bash
curl -X POST "https://your-domain.com/api/files" \
  -H "X-AGENTIC-ALLY-TOKEN: YOUR_TOKEN" \
  -H "X-COMPANY-ID: YOUR_COMPANY_ID" \
  -F "file=@/path/to/file.pdf"
```

**Serve Policy:**
```bash
curl -X GET "https://your-domain.com/api/policies/policies/YOUR_COMPANY_ID/FILE_ID.pdf" \
  -H "X-AGENTIC-ALLY-TOKEN: YOUR_TOKEN" \
  -H "X-COMPANY-ID: YOUR_COMPANY_ID"
```

## Security Checklist

- ✅ **Company Isolation**: Her endpoint `extractCompanyId()` ile company kontrolü yapıyor
- ✅ **Ownership Verification**: Delete ve serve endpoint'lerinde ownership kontrolü var
- ✅ **Path Validation**: Serve endpoint'inde path validation var (`policies/${companyId}/`)
- ✅ **Database Index**: `companyId` üzerinde index var (performans için)
- ✅ **Error Handling**: Tüm endpoint'lerde uygun error handling var

## Troubleshooting

### D1 Binding Not Found
- `wrangler.jsonc` içindeki `database_id` doğru mu kontrol et
- Migration'lar apply edildi mi kontrol et
- `wrangler d1 migrations list agentic-ally-db --remote` ile migration listesini kontrol et

### R2 Binding Not Found
- `wrangler.jsonc` içindeki `bucket_name` doğru mu kontrol et
- Bucket oluşturuldu mu kontrol et: `wrangler r2 bucket list`
- Binding name `POLICIES_BUCKET` ile eşleşiyor mu kontrol et

### Policy URLs Not Working
- `server/api/policies/[path].get.ts` endpoint'inin deploy edildiğinden emin ol
- Path encoding doğru mu kontrol et (`encodeURIComponent` kullanılıyor)
- Company ID extraction çalışıyor mu kontrol et

## Local vs Remote Differences

| Feature | Local | Remote |
|---------|-------|--------|
| D1 Database | `--local` flag | `--remote` flag |
| R2 Bucket | `nitro-cloudflare-dev` emulates | Real Cloudflare R2 |
| Migrations | `wrangler d1 migrations apply ... --local` | `wrangler d1 migrations apply ... --remote` |
| Secrets | `wrangler.jsonc` vars | `wrangler secret put` |

## Next Steps

1. ✅ Migration'ı remote'a apply et
2. ✅ R2 bucket'ı oluştur
3. ✅ Secrets'ları set et
4. ✅ Build ve deploy et
5. ✅ Test et

## Notes

- Local'de `nitro-cloudflare-dev` R2'yi emulate eder
- Remote'da gerçek Cloudflare R2 kullanılır
- Migration'lar sadece bir kez apply edilir (idempotent)
- R2 bucket'lar otomatik oluşturulmaz, manuel oluşturulmalı

