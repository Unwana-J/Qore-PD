import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gejtncnrppdzzkpgdmxl.supabase.co',
  'sb_publishable_XhzQlXFoUwAmSA8NfhWSYQ_IUtz5c9H'
);

async function seed() {
  // Use last week's Monday as a sample
  const lastMonday = "2026-04-20";
  const mockDigest = {
    weekOf: lastMonday,
    generatedAt: new Date("2026-04-20T09:00:00Z").toISOString(),
    totalActive: 14,
    completedThisWeek: 3,
    mappingRequestsPending: 5,
    suspensionRequestsPending: 2,
    dateExtensionRequestsPending: 1,
    overdueCount: 4,
    imActivity: [
      { imName: "Feranmi Akindele", totalActive: 6, completedThisWeek: 1, overdueCount: 1 },
      { imName: "Unwana Jackson", totalActive: 5, completedThisWeek: 2, overdueCount: 2 },
      { imName: "Adewale King", totalActive: 3, completedThisWeek: 0, overdueCount: 1 }
    ],
    upcomingDeadlines: [
      { id: "sample-1", clientName: "First Bank PLC", serviceName: "Core Banking Integration", targetDate: "2026-05-05", im: "Feranmi Akindele" },
      { id: "sample-2", clientName: "GTBank", serviceName: "NQR Payments", targetDate: "2026-05-07", im: "Unwana Jackson" },
      { id: "sample-3", clientName: "Zenith Bank", serviceName: "Salary Payments", targetDate: "2026-05-10", im: "Adewale King" }
    ]
  };

  console.log("Attempting to seed mock implementation digest...");
  const { error } = await supabase
    .from('implementation_digests')
    .upsert({ week_of: lastMonday, data: mockDigest });

  if (error) {
    console.error("Error seeding digest:", error);
    if (error.code === '42P01') {
      console.log("Table 'implementation_digests' does not exist yet. Please run the SQL migration.");
    }
  } else {
    console.log("Mock implementation digest for 2026-04-20 seeded successfully!");
  }
}

seed();
