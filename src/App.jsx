import React, { useState } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Tree, TreeNode } from "react-organizational-chart";
import { Upload, Download, Minus, Plus } from "lucide-react";

const COMPANY_COLORS = {
  "УК": "#e0f2ff",
  "ДК": "#e6fce6",
  "РТ": "#fff9db"
};

function getCompanyColor(companyField) {
  if (!companyField) return "#fff";
  const companies = companyField.split(/[,;]/).map(c => c.trim());
  if (companies.length > 1) {
    const colors = companies.map(c => COMPANY_COLORS[c] || "#ccc");
    return `linear-gradient(135deg, ${colors.join(", ")})`;
  }
  return COMPANY_COLORS[companies[0]] || "#fff";
}

function isManager(id, data) {
  return data.some((item) => item.ManagerId === id);
}

function EmployeeCard({ person, data, hasChildren, collapsed, toggle }) {
  const isBoss = isManager(person.Id, data);
  const bg = getCompanyColor(person.Company);
  const outline = isBoss ? 'outline outline-1 outline-dashed outline-blue-400' : '';
  return (
    <div
      style={{ background: bg }}
      className={`p-1 text-[9px] text-center leading-tight rounded-xl shadow-md w-64 h-30 font-roboto flex flex-col justify-between mx-auto border ${outline}`}
    >
      <div className="relative h-full w-full">
        <img
          src={person.Photo || "https://via.placeholder.com/40"}
          alt="Фото"
          className="w-10 h-10 rounded-full object-cover mx-auto"
        />
        <div className="font-semibold leading-tight">{person.Name}</div>
        <div className="text-gray-700 text-[10px]">{person.Position}</div>
        <div className="text-gray-600 text-[11px]">{person.Department}</div>
        <div className="text-gray-600 text-[11px]">{person.Mobile}</div>
        <div className="text-gray-600 text-[11px]">{person.Email}</div>
        <div className="absolute top-1 right-1 text-right text-[10px] space-y-0.5">
          <div className="text-gray-500">{person.Company}</div>
          <div className="text-gray-400 italic">{person.Location}</div>
        </div>
        {hasChildren && (
          <button
            onClick={toggle}
            className="absolute bottom-1.5 right-1.5 bg-white rounded-full border border-gray-300 shadow w-4 h-4 flex items-center justify-center hover:bg-gray-100"
          >
            {collapsed ? <Plus size={10} /> : <Minus size={10} />}
          </button>
        )}
      </div>
    </div>
  );
}

function OrgNode({ node, data, isRoot = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  const content = (
    <EmployeeCard
      person={node}
      data={data}
      hasChildren={hasChildren}
      collapsed={collapsed}
      toggle={() => setCollapsed(!collapsed)}
    />
  );

  if (isRoot) {
    return (
      <TreeNode
        className="no-top-line"
        label={
          <div className="relative">
            <div className="absolute -top-[20px] left-1/2 transform -translate-x-1/2 w-2 h-2 bg-[#bbb] rounded-full z-10" />
            {content}
          </div>
        }
      >
        {!collapsed &&
          node.children.map((child) => (
            <OrgNode key={child.Id} node={child} data={data} />
          ))}
      </TreeNode>
    );
  }

  return (
    <TreeNode label={content}>
      {!collapsed && node.children.map((child) => (
        <OrgNode key={child.Id} node={child} data={data} />
      ))}
    </TreeNode>
  );
}

function parseHierarchy(data) {
  const map = {};
  data.forEach((item) => {
    map[item.Id] = { ...item, children: [] };
  });
  const root = [];
  data.forEach((item) => {
    if (item.ManagerId && map[item.ManagerId]) {
      map[item.ManagerId].children.push(map[item.Id]);
    } else {
      root.push(map[item.Id]);
    }
  });
  return root;
}

export default function OrgChartApp() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .oc-root > .oc-node > .oc-line {
        border-top-color: transparent !important;
      }
      .no-top-line > .oc-line {
        border-top-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [fileName, setFileName] = useState("");
  const [scale, setScale] = useState(0.75);
  const [data, setData] = useState([]);
  const [tree, setTree] = useState([]);
  const [filter, setFilter] = useState("Все");

  function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const binaryStr = e.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet);

      const structured = json.map((r) => ({
        ...r,
        Id: r.Id?.toString().trim(),
        ManagerId: r.ManagerId?.toString().trim(),
      }));
      setData(structured);
      setTree(parseHierarchy(structured));
    };
    reader.readAsBinaryString(file);
  }

  function filterTreeByCompany(nodes, company) {
    return nodes
      .map((node) => {
        const companies = node.Company?.split(/[,;]/).map(c => c.trim()) || [];
        const match = companies.includes(company);
        const filteredChildren = filterTreeByCompany(node.children || [], company);
        if (match || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter(Boolean);
  }

  const filteredTree = filter === "Все" ? tree : filterTreeByCompany(tree, filter);

  return (
    <div className="p-6 space-y-4 font-roboto">
      <header className="flex items-center gap-6">
        <div className="flex gap-2 text-sm">
          <button onClick={() => setScale(prev => Math.max(prev - 0.1, 0.3))}>−</button>
          <button onClick={() => setScale(1)}>100%</button>
          <button onClick={() => setScale(prev => Math.min(prev + 0.1, 2))}>+</button>
        </div>
        <img
          src="https://www.dongchengtool.com/_nuxt/img/logo.c0f8da1.png"
          alt="DongCheng"
          className="h-10 max-w-[180px] object-contain"
        />
      </header>

      <div className="flex items-center gap-4">
        <input type="file" accept=".xlsx" onChange={handleFile} />
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="Все">Все компании</option>
          <option value="УК">УК</option>
          <option value="ДК">ДК</option>
          <option value="РТ">РТ</option>
        </select>
      </div>

      <div className="text-sm text-gray-600 border px-3 py-2 rounded-md max-w-xl space-y-1">
        <strong>Легенда:</strong>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#e0f2ff' }}></div>
            <span>УК</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#e6fce6' }}></div>
            <span>ДК</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fff9db' }}></div>
            <span>РТ</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded border-2 border-dashed border-blue-600"></div>
            <span>Руководитель</span>
          </div>
          <div className="flex items-center gap-1">
            <Plus size={14} className="border border-gray-400 rounded-sm" />
            <span>Развернуть</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus size={14} className="border border-gray-400 rounded-sm" />
            <span>Свернуть</span>
          </div>
        </div>
      </div>

      <div id="org-container" className="overflow-auto p-4 border rounded-xl h-[80vh]">
        <div className="w-full h-full flex justify-center items-start overflow-auto">
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            <Tree
              className="oc-root"
              lineWidth={"1px"}
              lineColor={"#bbb"}
              lineBorderRadius={"8px"}
              label={null}
            >
              {filteredTree.map((node) => (
                <OrgNode key={node.Id} node={node} data={data} isRoot={true} />
              ))}
            </Tree>
          </div>
        </div>
      </div>
    </div>
  );
}
