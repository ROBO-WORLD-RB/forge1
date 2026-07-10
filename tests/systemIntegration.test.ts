import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Intercept Supabase with a high-fidelity in-memory database mock
vi.mock('../services/supabase', () => {
  let profiles: any[] = [];
  let workerProfiles: any[] = [];
  let portfolios: any[] = [];
  let endorsements: any[] = [];
  let jobs: any[] = [];
  let bookings: any[] = [];
  let notifications: any[] = [];

  const tableData = (table: string): any[] => {
    if (table === 'profiles') return profiles;
    if (table === 'worker_profiles') return workerProfiles;
    if (table === 'worker_portfolios') return portfolios;
    if (table === 'worker_endorsements') return endorsements;
    if (table === 'jobs') return jobs;
    if (table === 'bookings') return bookings;
    if (table === 'notifications') return notifications;
    return [];
  };

  const mockFrom = (table: string) => {
    let currentData: any[] = tableData(table);

    const builder: any = {
      delete: () => {
        return {
          in: (col: string, vals: any[]) => {
            if (table === 'profiles') {
              profiles = profiles.filter(r => !vals.includes(r[col]));
            }
            return { error: null, data: null };
          },
          eq: (col: string, val: any) => {
            if (table === 'worker_portfolios') {
              portfolios = portfolios.filter(r => r[col] !== val);
            }
            return { error: null, data: null };
          }
        };
      },
      insert: (rows: any | any[]) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        const inserted: any[] = [];
        for (const row of arr) {
          const newRow = { 
            id: row.id || `id-${Math.random().toString(36).slice(2)}`, 
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString(), 
            ...row 
          };
          const target = tableData(table);
          target.push(newRow);
          inserted.push(newRow);
        }
        return {
          select: () => {
            return {
              single: () => {
                return { data: inserted[0], error: null };
              }
            };
          }
        };
      },
      select: (fields?: string) => {
        // Prepare data with joined relations pre-evaluated
        const getJoinedData = () => {
          const source = tableData(table);

          return source.map(row => {
            const r = { ...row };
            if (table === 'worker_profiles' && fields && fields.includes('profiles')) {
              const jp = profiles.find(p => p.id === r.user_id);
              r.profiles = jp ? { avatar_url: jp.avatar_url } : null;
            }
            if (table === 'worker_endorsements' && fields && fields.includes('profiles')) {
              const jp = profiles.find(p => p.id === r.referrer_id);
              r.profiles = jp ? {
                first_name: jp.first_name,
                last_name: jp.last_name,
                username: jp.username,
                avatar_url: jp.avatar_url,
                role: jp.role
              } : null;
            }
            return r;
          });
        };

        const chain: any = {
          eq: (col: string, val: any) => {
            const filtered = getJoinedData().filter(r => r[col] === val);
            // Return a new chain operating on the filtered subset
            return {
              order: (orderCol: string, opts?: any) => {
                return {
                  then: (resolve: any) => resolve({ data: filtered, error: null })
                };
              },
              single: () => {
                const data = filtered[0] || null;
                if (!data) {
                  return { data: null, error: { message: 'Record not found' } };
                }
                return { data, error: null };
              },
              maybeSingle: () => {
                const data = filtered[0] || null;
                return { data, error: null };
              },
              then: (resolve: any) => resolve({ data: filtered, error: null })
            };
          },
          order: (col: string, opts?: any) => {
            return {
              then: (resolve: any) => resolve({ data: getJoinedData(), error: null })
            };
          },
          single: () => {
            const data = getJoinedData()[0] || null;
            if (!data) {
              return { data: null, error: { message: 'Record not found' } };
            }
            return { data, error: null };
          },
          maybeSingle: () => {
            const data = getJoinedData()[0] || null;
            return { data, error: null };
          },
          then: (resolve: any) => resolve({ data: getJoinedData(), error: null })
        };
        return chain;
      }
    };
    return builder;
  };

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: async () => ({ data: { session: null }, error: null })
      }
    },
    isSupabaseConfigured: () => true,
    getSession: async () => null,
    initialize: async () => {}
  };
});

// Import services after the mock configuration has been hoisted
import { 
  getProfile, 
  getProfileByUsername, 
  getPortfolioItems, 
  createPortfolioItem, 
  deletePortfolioItem, 
  getEndorsements, 
  createEndorsement 
} from '../services/workerService';
import { createBooking, createDirectBooking } from '../services/bookingService';
import { supabase } from '../services/supabase';

describe('Real-Time System Integration E2E Tests', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testRefereeId = '00000000-0000-0000-0000-000000000002';
  const testCustomerId = '00000000-0000-0000-0000-000000000003';
  const testUsername = `@test_network_slug_${Date.now().toString(36)}`;
  
  beforeAll(async () => {
    // Clean up
    await supabase.from('profiles').delete().in('id', [testUserId, testRefereeId, testCustomerId]);

    // Insert mock profiles in database simulator
    const { error: error1 } = await supabase.from('profiles').insert([
      {
        id: testUserId,
        first_name: 'Test',
        last_name: 'Referrer',
        username: '@test_referrer',
        phone: '+233500000001',
        country: 'GH',
        role: 'worker',
        worker_status: 'active',
        profile_completed: true,
      },
      {
        id: testRefereeId,
        first_name: 'Test',
        last_name: 'Referee',
        username: testUsername,
        phone: '+233500000002',
        country: 'GH',
        role: 'worker',
        worker_status: 'active',
        profile_completed: true,
      },
      {
        id: testCustomerId,
        first_name: 'Test',
        last_name: 'Customer',
        username: '@test_customer',
        phone: '+233500000003',
        country: 'GH',
        role: 'customer',
        profile_completed: true,
      }
    ]);
    if (error1) console.error('Error seeding profiles:', error1.message);

    // Insert mock worker profiles in database simulator (ID matches Referee / Referrer ID for easy retrieval)
    const { error: error2 } = await supabase.from('worker_profiles').insert([
      {
        id: testUserId,
        user_id: testUserId,
        name: 'Test Referrer Pro',
        role: 'Electrician',
        location: 'Accra',
        country: 'GH',
        skills: ['Wiring', 'Testing'],
      },
      {
        id: testRefereeId,
        user_id: testRefereeId,
        name: 'Test Referee Pro',
        role: 'Plumber',
        location: 'Accra',
        country: 'GH',
        skills: ['Plumbing', 'Draining'],
      }
    ]);
    if (error2) console.error('Error seeding worker profiles:', error2.message);
  });

  afterAll(async () => {
    // Cleanup profiles
    await supabase.from('profiles').delete().in('id', [testUserId, testRefereeId, testCustomerId]);
  });

  it('Verify profile retrieval by UUID', async () => {
    const { data, error } = await getProfile(testRefereeId);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.name).toBe('Test Referee Pro');
    expect(data?.user_id).toBe(testRefereeId);
  });

  it('Verify profile retrieval by Custom Username Slug', async () => {
    const { data, error } = await getProfileByUsername(testUsername);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.name).toBe('Test Referee Pro');
    expect(data?.user_id).toBe(testRefereeId);
  });

  it('Verify portfolio creation, listing, and deletion flow', async () => {
    // 1. Create a portfolio item
    const portfolioTitle = 'Ghana Mall Piping Project';
    const { data: createdItem, error: createError } = await createPortfolioItem(testRefereeId, {
      title: portfolioTitle,
      description: 'Full installation of water supply pipelines.',
      media_urls: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758'],
    });

    expect(createError).toBeNull();
    expect(createdItem).not.toBeNull();
    expect(createdItem.title).toBe(portfolioTitle);
    expect(createdItem.worker_id).toBe(testRefereeId);

    // 2. List portfolio items
    const { data: listData, error: listError } = await getPortfolioItems(testRefereeId);
    expect(listError).toBeNull();
    expect(listData).not.toBeNull();
    expect(listData?.length).toBeGreaterThan(0);
    expect(listData?.[0].title).toBe(portfolioTitle);

    // 3. Delete the portfolio item
    const { data: deleteSuccess, error: deleteError } = await deletePortfolioItem(createdItem.id);
    expect(deleteError).toBeNull();
    expect(deleteSuccess).toBe(true);

    // 4. List again and confirm deletion
    const { data: cleanList } = await getPortfolioItems(testRefereeId);
    expect(cleanList?.length).toBe(0);
  });

  it('Verify pro-to-pro endorsements loop', async () => {
    // 1. Add endorsement from Referrer to Referee
    const endorsementText = 'Excellent colleague. Highly recommended for complex plumbing work!';
    const { data: createdEndorsement, error: endError } = await createEndorsement(
      testUserId,
      testRefereeId,
      endorsementText
    );

    expect(endError).toBeNull();
    expect(createdEndorsement).not.toBeNull();
    expect(createdEndorsement.referrer_id).toBe(testUserId);
    expect(createdEndorsement.referee_id).toBe(testRefereeId);
    expect(createdEndorsement.endorsement_text).toBe(endorsementText);

    // 2. Fetch endorsements and verify Referrer profile details are joined
    const { data: listData, error: listError } = await getEndorsements(testRefereeId);
    expect(listError).toBeNull();
    expect(listData).not.toBeNull();
    expect(listData?.length).toBeGreaterThan(0);
    expect(listData?.[0].endorsement_text).toBe(endorsementText);
    expect(listData?.[0].profiles?.first_name).toBe('Test');
    expect(listData?.[0].profiles?.last_name).toBe('Referrer');
  });

  it('createDirectBooking creates linked job and pending booking', async () => {
    const scheduledDate = '2026-08-15';
    const hours = 3;
    const hourlyRate = 50;
    const description = 'Fix kitchen sink';

    const { data, error } = await createDirectBooking({
      customerId: testCustomerId,
      workerUserId: testRefereeId,
      workerName: 'Test Referee Pro',
      workerRole: 'Plumber',
      location: 'Accra',
      country: 'GH',
      hours,
      hourlyRate,
      currency: 'GHS',
      scheduledDate,
      description,
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.job.poster_user_id).toBe(testCustomerId);
    expect(data!.job.title).toContain('Direct booking: Test Referee Pro');
    expect(data!.job.budget_min).toBe(hours * hourlyRate);
    expect(data!.job.budget_max).toBe(hours * hourlyRate);
    expect(data!.job.scheduled_at).toBe(`${scheduledDate}T09:00:00.000Z`);
    expect(data!.booking.status).toBe('PENDING');
    expect(data!.booking.worker_user_id).toBe(testRefereeId);
    expect(data!.booking.customer_user_id).toBe(testCustomerId);
    expect(data!.booking.job_id).toBe(data!.job.id);
    expect(data!.booking.customer_message).toContain(description);
    expect(data!.booking.customer_message).toContain(`Scheduled: ${scheduledDate}`);
  });

  it('createBooking notifies the customer (job poster), not the worker', async () => {
    const { data: jobRow } = await supabase.from('jobs').insert({
      poster_user_id: testCustomerId,
      title: 'Leaky faucet repair',
      description: 'Kitchen faucet dripping',
      category: 'plumbing',
      location: 'Accra',
      country: 'GH',
      budget_min: 100,
      budget_max: 150,
      currency: 'GHS',
      status: 'open',
    }).select().single();

    const { data: booking, error } = await createBooking(
      jobRow!.id,
      testRefereeId,
      'Please come in the morning'
    );

    expect(error).toBeNull();
    expect(booking).not.toBeNull();

    const { data: notificationRows } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testCustomerId);

    expect(notificationRows).not.toBeNull();
    expect(notificationRows!.length).toBeGreaterThan(0);
    const latest = notificationRows!.find(
      (n: { metadata?: { booking_id?: string } }) => n.metadata?.booking_id === booking!.id
    );
    expect(latest).toBeDefined();
    expect(latest!.type).toBe('booking_request');
    expect(latest!.user_id).toBe(testCustomerId);
    expect(latest!.user_id).not.toBe(testRefereeId);
  });

  it('createDirectBooking surfaces job creation failure without creating a booking', async () => {
    const jobService = await import('../services/jobService');
    const createJobSpy = vi.spyOn(jobService, 'createJob').mockResolvedValueOnce({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
    });

    const { data, error } = await createDirectBooking({
      customerId: testCustomerId,
      workerUserId: testRefereeId,
      workerName: 'Test Referee Pro',
      workerRole: 'Plumber',
      location: 'Accra',
      country: 'GH',
      hours: 2,
      hourlyRate: 40,
      currency: 'GHS',
      scheduledDate: '2026-09-01',
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Missing required fields');
    createJobSpy.mockRestore();
  });
});
