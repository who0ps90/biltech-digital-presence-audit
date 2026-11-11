import type { Group } from './types.js';
export type CriterionId = 'rating' | 'reviews' | 'name' | 'category' | 'status' | 'phone' | 'address' | 'hours' | 'photos' | 'website' | 'accessibility' | 'https' | 'title' | 'description' | 'social' | 'cta' | 'messaging' | 'email' | 'booking';
export interface CriterionPolicy { category: Group; label: string; max: number; impact: number; why: string; issue: string; improvement: string; }
const gbp: Group = 'Google Business Profile', web: Group = 'Website Presence & Health', social: Group = 'Social Media Presence', enquiry: Group = 'Customer Enquiry Readiness';
const criterion = (category: Group, label: string, max: number, impact: number, issue: string, why: string, improvement: string): CriterionPolicy => ({ category, label, max, impact, issue, why, improvement });
export const SCORING_POLICY = {
  version: '2.1', denominator: 'fixed' as const, maximumPoints: 100, unverifiedPoints: 0, ratingTarget: 4.5, reviewCountTarget: 50, preliminaryCoverage: 70, socialOnePoints: 3,
  titleMinimumLength: 3, genericTitles: ['home', 'homepage', 'untitled', 'index', 'welcome'],
  labelThresholds: { excellent: 90, good: 75, attention: 60 },
  recommendationWeights: { impact: 20, severity: 10, confidence: 10, recoverable: 1 },
  categories: [gbp, web, social, enquiry] as Group[],
  appointmentTypes: ['dentist', 'doctor', 'hair_salon', 'barber_shop', 'beauty_salon', 'spa', 'veterinary_care', 'physiotherapist', 'massage'],
  nonAppointmentTypes: ['supermarket', 'grocery_store', 'convenience_store', 'clothing_store', 'electronics_store', 'book_store', 'hardware_store', 'shoe_store'],
  criteria: {
    rating: criterion(gbp, 'Average Google rating', 10, 4, 'Average rating is below the Biltech target', 'Customers may consider published feedback when choosing a business.', 'Review recurring service concerns and invite honest feedback without incentives or review gating.'),
    reviews: criterion(gbp, 'Google review count', 10, 3, 'Review volume is below the Biltech target', 'A broader base of genuine feedback gives customers more context.', 'Encourage genuine customers to leave Google reviews through a consistent review-request process.'),
    name: criterion(gbp, 'Business name', 3, 3, 'Review the public business name', 'A recognizable name helps customers identify the business.', 'Check that the listing uses the real-world business name.'),
    category: criterion(gbp, 'Primary business category', 6, 3, 'Review the primary category', 'Category presence helps describe the business, but does not establish suitability.', 'Confirm the most accurate primary category in Business Profile. Presence alone does not prove suitability.'),
    status: criterion(gbp, 'Business status', 3, 5, 'The listing is marked closed', 'A closed status changes customer expectations.', 'If the status is inaccurate, update it. Otherwise keep closure information current.'),
    phone: criterion(gbp, 'Business phone number', 6, 4, 'Review the public phone number', 'Customers need a reachable business contact number.', 'Confirm the correct customer-facing phone number in Business Profile.'),
    address: criterion(gbp, 'Address or service area', 4, 3, 'Review location information', 'Accurate location information helps customers plan.', 'Confirm the location or service area. Eligible service-area businesses should keep residential addresses hidden.'),
    hours: criterion(gbp, 'Published opening hours', 8, 4, 'Review opening hours', 'Customers need to know when the business is available.', 'Confirm applicable regular and holiday opening hours in Business Profile.'),
    photos: criterion(gbp, 'Public photo availability', 10, 2, 'Review business photos', 'Representative photos give customers useful context.', 'Check that public photos accurately represent the business. Quality and recency require manual review.'),
    website: criterion(web, 'Website listed', 6, 5, 'Business website is confirmed unavailable', 'A website gives customers a place to understand your services.', 'Add a business website so potential customers can learn more about your services.'),
    accessibility: criterion(web, 'Website accessibility', 6, 5, 'Website could not be accessed successfully', 'An available website lets customers reach your information.', 'Investigate the observed HTTP error and verify the site in a regular browser.'),
    https: criterion(web, 'Valid HTTPS connectivity', 3, 5, 'Website was served over HTTP', 'HTTPS protects data in transit and supports customer trust.', 'Enable valid HTTPS and redirect HTTP requests to the secure address.'),
    title: criterion(web, 'Meaningful homepage title', 3, 2, 'Homepage title needs attention', 'A descriptive title helps visitors identify the page.', 'Add a descriptive homepage title containing the business name and relevant service context.'),
    description: criterion(web, 'Homepage meta description', 2, 2, 'Homepage meta description was not found', 'A useful description summarizes the page for people and search services.', 'Add a concise, non-empty meta description that accurately describes the business.'),
    social: criterion(social, 'Discoverable social profiles', 5, 2, 'Social links are missing or limited on the homepage', 'Discoverable official profiles give visitors additional ways to learn about the business.', 'Consider linking your active official social media accounts from your website. You do not need every platform.'),
    cta: criterion(enquiry, 'Customer contact CTA', 4, 5, 'No clear contact CTA was discovered', 'An obvious next step helps visitors make an enquiry.', 'Add a visible call, contact, WhatsApp, or appointment action for customers.'),
    messaging: criterion(enquiry, 'Direct messaging channel', 3, 3, 'No direct messaging option was discovered', 'A suitable messaging channel can make enquiries more convenient.', 'If WhatsApp is a suitable communication channel, consider adding a direct WhatsApp enquiry option.'),
    email: criterion(enquiry, 'Email or customer enquiry form', 3, 4, 'No email link or enquiry form was discovered', 'An enquiry route supports customers who prefer written communication.', 'Add a mailto contact link or an accessible customer enquiry form.'),
    booking: criterion(enquiry, 'Online booking or appointment link', 5, 4, 'No booking option was discovered', 'For appointment-based businesses, booking links clarify the next step.', 'For appointment-based businesses, add a clear booking or consultation link.'),
  } satisfies Record<CriterionId, CriterionPolicy>,
};
