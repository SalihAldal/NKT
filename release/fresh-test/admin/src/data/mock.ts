export const mockStats = {
  totalUsers: 12847,
  dau: 2341,
  quizzesCreated: 892,
  quizzesSolved: 4521,
  shares: 1893,
  inviteConversion: 12.4,
  premiumConversion: 4.8,
  adRevenue: 12450,
  aiUsage: 3421,
  retention7d: 38.2,
};

export const mockUsers = Array.from({ length: 50 }, (_, i) => ({
  id: `u${i + 1}`,
  name: ['Salih', 'Ahmet', 'Zeynep', 'Mehmet', 'Ayşe'][i % 5] + ' ' + ['Aydın', 'Yılmaz', 'Kaya', 'Demir', 'Çelik'][i % 5],
  email: `user${i + 1}@nkt.app`,
  username: `user${i + 1}`,
  status: i % 7 === 0 ? 'suspended' : 'active',
  isPremium: i % 5 === 0,
  quizzes: Math.floor(Math.random() * 20),
  joinedAt: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
}));

export const mockQuizzes = Array.from({ length: 30 }, (_, i) => ({
  id: `q${i + 1}`,
  title: `Test ${i + 1}`,
  creator: mockUsers[i % 10]?.name ?? 'Unknown',
  questions: 5 + (i % 10),
  status: i % 4 === 0 ? 'draft' : 'published',
  solves: Math.floor(Math.random() * 100),
  createdAt: new Date(Date.now() - i * 43200000).toISOString().split('T')[0],
}));

export const mockReports = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i + 1}`,
  type: ['spam', 'abuse', 'inappropriate'][i % 3],
  reporter: mockUsers[i]?.name,
  target: mockQuizzes[i]?.title,
  status: i % 3 === 0 ? 'resolved' : 'pending',
  createdAt: new Date(Date.now() - i * 172800000).toISOString().split('T')[0],
}));
