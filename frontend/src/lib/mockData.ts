import { Persona } from '@/types';

export const PERSONAS: Record<string, Persona> = {
  lan: {
    userId: 'lan',
    name: 'Lan',
    company: 'CTY_A',
    department: 'DEPT_MKT_A',
    role: 'Staff',
    contractType: 'Official',
    description: 'Nhân viên chính thức, Marketing, Công ty A',
    scopePath: ['Tập đoàn Alpha', 'Công ty A (Alpha Media)', 'Phòng Marketing']
  },
  hung: {
    userId: 'hung',
    name: 'Hùng',
    company: 'CTY_B',
    department: 'DEPT_ENG_B',
    team: 'TEAM_PAY_B',
    role: 'TeamLead',
    contractType: 'Official',
    description: 'Trưởng nhóm Payments On-call, PB Kỹ thuật, Công ty B',
    scopePath: ['Tập đoàn Alpha', 'Công ty B (Alpha Pay)', 'Phòng Kỹ thuật', 'Nhóm Payments On-call']
  },
  mai: {
    userId: 'mai',
    name: 'Mai',
    company: 'CTY_A',
    department: 'DEPT_HR_A',
    role: 'HR_Admin',
    contractType: 'Official',
    description: 'HR Admin, PB Nhân sự, Công ty A',
    scopePath: ['Tập đoàn Alpha', 'Công ty A (Alpha Media)', 'Phòng Nhân sự']
  },
  nam: {
    userId: 'nam',
    name: 'Nam',
    company: 'CTY_A',
    department: 'DEPT_MKT_A',
    role: 'Contractor',
    contractType: 'Contractor',
    description: 'Nhà thầu / Cộng tác viên, Marketing, Công ty A',
    scopePath: ['Tập đoàn Alpha', 'Công ty A (Alpha Media)', 'Phòng Marketing']
  }
};

export const SAMPLE_QUERIES = [
  'Quy định nghỉ phép của tôi như thế nào?',
  'Thời gian báo trước khi nghỉ phép là bao lâu?',
  'Ai là người duyệt đơn nghỉ phép của tôi?',
  'Tôi có thể ứng trước ngày phép năm không?'
];
