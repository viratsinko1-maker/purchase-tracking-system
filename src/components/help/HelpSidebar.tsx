/**
 * Help Sidebar - Navigation menu for help sections
 */

export interface HelpSection {
  id: string;
  title: string;
  icon: string;
}

interface HelpSidebarProps {
  sections: HelpSection[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

export default function HelpSidebar({ sections, activeSection, onSectionChange }: HelpSidebarProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 sticky top-24">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">หัวข้อ</h2>
      <nav className="space-y-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition flex items-center gap-2 ${
              activeSection === section.id
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <span className="text-xl">{section.icon}</span>
            <span>{section.title}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
