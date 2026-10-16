import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bug,
  ChartColumn,
  Flower2,
  LayoutGrid,
  Package,
  Sprout,
  Wheat,
} from 'lucide-react';
import { PlaceholderPage } from './components/PlaceholderPage';

type NavItem = {
  path: string;
  label: string;
  description: string;
  session: string;
  icon: LucideIcon;
};

/**
 * One entry per section of the app.
 * Adding a section means adding an entry here plus a route below.
 */
const navItems: NavItem[] = [
  {
    path: '/garden',
    label: 'Garden',
    description: 'The layout of the plot: beds, pots and borders, and where each planting sits.',
    session: 'S05',
    icon: LayoutGrid,
  },
  {
    path: '/plantings',
    label: 'Plantings',
    description: 'What was planted, where and when, and the full history of each plant.',
    session: 'S06',
    icon: Sprout,
  },
  {
    path: '/species',
    label: 'Species',
    description: 'The catalogue of flowers, vegetables, fruit and herbs that can be planted.',
    session: 'S04',
    icon: Flower2,
  },
  {
    path: '/issues',
    label: 'Issues',
    description: 'Pests, disease and other problems, tracked from open to resolved.',
    session: 'S09',
    icon: Bug,
  },
  {
    path: '/harvests',
    label: 'Harvests',
    description: 'What was picked, how much and when.',
    session: 'S10',
    icon: Wheat,
  },
  {
    path: '/seeds',
    label: 'Seeds',
    description: 'Seeds kept after harvest, with quantity and storage details.',
    session: 'S10',
    icon: Package,
  },
  {
    path: '/statistics',
    label: 'Statistics',
    description: 'How the plants are performing: yield, timing, care frequency and survival.',
    session: 'S11',
    icon: ChartColumn,
  },
  {
    path: '/guides',
    label: 'Guides',
    description: 'Gardening guides, tips and tricks collected from around the web.',
    session: 'S12',
    icon: BookOpen,
  },
];

function navLinkClass(isActive: boolean): string {
  return isActive ? 'nav__link nav__link--active' : 'nav__link';
}

/** Keeps the route JSX short enough to stay on one line. */
function placeholderFor(item: NavItem) {
  const { label, description, session } = item;
  return <PlaceholderPage title={label} description={description} session={session} />;
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <Sprout aria-hidden="true" size={24} />
            <div>
              <p className="sidebar__title">Garden</p>
              <p className="sidebar__subtitle">Plot records</p>
            </div>
          </div>

          <nav className="nav" aria-label="Sections">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => navLinkClass(isActive)}>
                <item.icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/garden" replace />} />
            {navItems.map((item) => (
              <Route key={item.path} path={item.path} element={placeholderFor(item)} />
            ))}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
