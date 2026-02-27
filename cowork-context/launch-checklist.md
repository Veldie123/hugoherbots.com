# HugoHerbots.ai — Launch Preparation Checklist

## Platform Status (Current)

### Working & Tested
- [x] E.P.I.C. Techniques library (54 techniques, 5 phases)
- [x] Video library with Mux playback (~700+ videos)
- [x] Video pipeline: Google Drive -> Cloud Run -> Mux -> Supabase
- [x] AutoHeal & AutoBatch automation
- [x] AI Chat (Talk to Hugo) — text mode with RAG
- [x] Audio mode (LiveKit + Deepgram + ElevenLabs)
- [x] Video mode (HeyGen streaming avatar)
- [x] Roleplay system with AI customers
- [x] Conversation Analysis (upload + diarization + scoring)
- [x] Dashboard with progress tracking
- [x] Admin panel (dual-view: Stephane super admin / Hugo content admin)
- [x] Config Review flow (Hugo proposes -> Stephane approves)
- [x] Dark mode support
- [x] Mobile responsive (card/grid view)
- [x] Supabase Auth (login/signup)
- [x] Stripe integration (subscriptions)

### Needs Attention Before Launch
- [ ] Final pricing tier configuration in Stripe
- [ ] Production deployment and domain setup (hugoherbots.ai)
- [ ] SSL certificate for production domain
- [ ] Email templates (welcome, password reset, subscription confirmation)
- [ ] Legal pages (privacy policy, terms of service, cookie policy)
- [ ] Analytics/tracking setup (Google Analytics, Mixpanel, or similar)
- [ ] Error monitoring (Sentry or similar)
- [ ] Backup strategy for Supabase data
- [ ] Load testing for concurrent users
- [ ] Onboarding flow for new users (first-time experience)
- [ ] Help/FAQ content populated with real answers
- [ ] SEO basics (meta tags, OG images, sitemap)
- [ ] Social media profiles ready (LinkedIn, Twitter/X)
- [ ] Demo video or walkthrough for landing page
- [ ] Beta user feedback incorporated
- [ ] Performance optimization (bundle size, lazy loading)

## Daily Maintenance Tasks (Post-Launch)
1. **Morning check**: Verify all 3 services are running (Vite, Video Processor, Hugo Engine)
2. **Video pipeline**: Check AutoBatch status, any failed jobs in Supabase
3. **User signups**: Review new registrations in Supabase Auth
4. **Config Review**: Check for pending corrections from Hugo
5. **Error logs**: Scan for errors in deployment logs
6. **Stripe**: Verify payments processing, check for failed charges
7. **Content**: Review any new videos added by Hugo via Google Drive
8. **Support**: Check for user questions/issues

## Weekly Maintenance Tasks
1. **Analytics review**: User engagement, video completion rates, chat usage
2. **RAG quality**: Review RAG search results for relevance
3. **Technique scoring**: Review analysis accuracy and calibrate evaluator
4. **Performance**: Check response times, Mux streaming quality
5. **Costs**: Monitor OpenAI/ElevenLabs/HeyGen/Mux usage and costs
6. **Content calendar**: Plan social media and email content with Hugo
7. **Backup verification**: Ensure Supabase backups are running

## Go-To-Market Channels
1. **Hugo's existing network** — LinkedIn (Hugo's personal brand is strong)
2. **Email list** — Hugo's existing contacts from in-person training
3. **Content marketing** — Blog posts, LinkedIn articles about E.P.I.C. methodology
4. **Webinars** — Free preview sessions using the Live Coaching feature
5. **Referrals** — Beta users recommend to colleagues
6. **Partnerships** — Sales consultancies, CRM vendors, HR platforms
7. **SEO** — Target "sales coaching", "verkooptechnieken", "B2B sales training Belgium"
