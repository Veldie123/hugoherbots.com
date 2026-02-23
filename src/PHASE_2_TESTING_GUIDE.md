# 🧪 Phase 2: Multi-Tenant Testing Guide

**Status:** ✅ Backend Ready - Frontend Integration Needed

---

## ❌ **WAT WERKT NIET in Figma Make:**

### OAuth (Google/Microsoft) ❌
**Waarom:** Figma Make heeft dynamic URLs (`figma.site`)  
**OAuth vereist:** Fixed redirect URLs  
**Conclusie:** OAuth testen is NIET mogelijk in Figma Make

**Waar werkt het WEL:**
- ✅ Local development (`localhost:3000`)
- ✅ Staging/Production (eigen domein)

**Workaround:** Gebruik email/password signup voor testing in Figma Make

---

## ✅ **WAT WERKT WEL in Figma Make:**

### Email/Password Signup ✅
- ✅ Signup via backend route
- ✅ Auto-provisioning workspace
- ✅ Login via backend route
- ✅ Workspace fetch/list

---

## 🚀 **TESTING STEPS:**

### STEP 1: Update Frontend Signup Component

<function_calls>
<invoke name="read">
<parameter name="path">/components/HH