import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import type { ReactNode } from 'react';
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
import { GardenPage } from './pages/GardenPage';
import { HarvestsPage } from './pages/HarvestsPage';
import { IssuesPage } from './pages/IssuesPage';
import { PlantingDetailPage } from './pages/PlantingDetailPage';
import { PlantingsPage } from './pages/PlantingsPage';
import { SeedsPage } from './pages/SeedsPage';
import { SpeciesPage } from './pages/SpeciesPage';

type NavItem = {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Set while the section is still a placeholder. */
  session?: string;
  /** Set once the section has a real page. */
  element?: ReactNode;
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
    icon: LayoutGrid,
    element: <GardenPage />,
  },
  {
    path: '/plantings',
    label: 'Plantings',
    description: 'What was planted, where and when, and the full history of each plant.',
    icon: Sprout,
    element: <PlantingsPage />,
  },
  {
    path: '/species',
    label: 'Species',
    description: 'The catalogue of flowers, vegetables, fruit and herbs that can be planted.',
    icon: Flower2,
    element: <SpeciesPage />,
  },
  {
    path: '/issues',
    label: 'Issues',
    description: 'Pests, disease and other problems, tracked from open to resolved.',
    icon: Bug,
    element: <IssuesPage />,
  },
  {
    path: '/harvests',
    label: 'Harvests',
    description: 'What was picked, how much and when.',
    icon: Wheat,
    element: <HarvestsPage />,
  },
  {
    path: '/seeds',
    label: 'Seeds',
    description: 'Seeds kept after harvest, with quantity and storage details.',
    icon: Package,
    element: <SeedsPage />,
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

/** The real page once a section exists, otherwise its placeholder. */
function sectionElement(item: NavItem) {
  if (item.element !== undefined) return item.element;
  return <PlaceholderPage title={item.label} description={item.description} session={item.session} />;
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
              <Route key={item.path} path={item.path} element={sectionElement(item)} />
            ))}
            {/* One level under a section, so a record can be opened on its own. */}
            <Route path="/plantings/:id" element={<PlantingDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
