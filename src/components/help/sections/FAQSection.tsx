/**
 * FAQ Section - คำถามที่พบบ่อย
 */

export default function FAQSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>❓</span> FAQ - คำถามที่พบบ่อย
        </h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          รวมคำถามและปัญหาที่พบบ่อยพร้อมวิธีแก้ไข
        </p>
      </div>

      <div className="space-y-4">
        {/* ปัญหาการเข้าสู่ระบบ */}
        <FAQCategory
          icon="🔑"
          title="ปัญหาการเข้าสู่ระบบ"
          bgColor="red"
          questions={[
            {
              q: "Login ไม่ได้ ขึ้นว่า Invalid credentials",
              a: "ตรวจสอบว่า Username และ Password ถูกต้อง (ระวังตัวพิมพ์ใหญ่-เล็ก) ถ้ายังไม่ได้ ให้ติดต่อ Admin เพื่อ Reset Password",
            },
            {
              q: "Login แล้วถูก Logout ออกทันที",
              a: "ลองลบ Cookie และ Cache ของเบราว์เซอร์ แล้ว Login ใหม่",
            },
            {
              q: "ลืมรหัสผ่าน",
              a: "ติดต่อ Admin เพื่อขอ Reset Password",
            },
          ]}
        />

        {/* ปัญหาไฟล์แนบ */}
        <FAQCategory
          icon="📎"
          title="ปัญหาไฟล์แนบ"
          bgColor="orange"
          questions={[
            {
              q: "คลิกเปิดไฟล์แล้วไม่เปิด หรือขึ้น Error 404",
              a: "เกิดจากสาเหตุดังนี้:",
              list: [
                "ยังไม่ได้เชื่อมต่อ Network Share (\\\\10.1.1.199\\b1_shr)",
                "ไฟล์ถูกย้ายหรือลบออกจาก SAP",
                "ไม่มีสิทธิ์เข้าถึงไฟล์ (เช่น POPR พยายามเปิดไฟล์ PO)",
              ],
              solution: "เปิด File Explorer แล้วพิมพ์ \\\\10.1.1.199\\b1_shr ใน Address Bar เพื่อเชื่อมต่อ Network Share",
            },
            {
              q: "ไฟล์แนบไม่แสดง หรือแสดงว่า \"ไม่มีไฟล์แนบ\" แต่ใน SAP มี",
              a: "ให้รอ Attachment Sync ทำงาน (ทุก 2 ชั่วโมง) หรือแจ้ง Admin เพื่อทำ Manual Attachment Sync",
            },
          ]}
        />

        {/* ปัญหาการ Sync */}
        <FAQCategory
          icon="🔄"
          title="ปัญหาการ Sync ข้อมูล"
          bgColor="blue"
          questions={[
            {
              q: "กด Sync แล้วไม่มีอะไรเปลี่ยนแปลง",
              a: "รอสักครู่ (อาจใช้เวลา 1-5 นาที) แล้ว Refresh หน้า ถ้ายังไม่เห็นข้อมูลใหม่ ให้ดูที่ Sync History ว่า Sync สำเร็จหรือไม่",
            },
            {
              q: "Sync ล้มเหลวบ่อยๆ",
              a: "อาจเกิดจากการเชื่อมต่อ SAP ขาด แจ้ง Admin หรือทีม IT เพื่อตรวจสอบ SAP HANA Connection",
            },
            {
              q: "PR ที่เห็นในระบบไม่ตรงกับใน SAP",
              a: "รอให้ Auto Sync ทำงาน หรือกด Manual Sync เอง (Sync ทุก 2 ชั่วโมง ดังนั้นข้อมูลอาจไม่ Realtime)",
            },
          ]}
        />

        {/* ปัญหาสิทธิ์การใช้งาน */}
        <FAQCategory
          icon="🔐"
          title="ปัญหาสิทธิ์การใช้งาน"
          bgColor="purple"
          questions={[
            {
              q: "เข้าหน้า PO Tracking ไม่ได้ ถูกส่งกลับไปหน้า PR Tracking",
              a: "Role ของคุณเป็น \"PR\" ซึ่งไม่มีสิทธิ์เข้าหน้า PO Tracking ถ้าต้องการให้แจ้ง Admin เพื่อเปลี่ยน Role",
            },
            {
              q: "ไม่เห็นเมนู \"จัดการผู้ใช้\" หรือ \"Activity Trail\"",
              a: "เมนู \"จัดการผู้ใช้\" และ \"Activity Trail\" มีเฉพาะ Admin เท่านั้น",
            },
            {
              q: "ตอบคำถามใน PR Q&A ไม่ได้ ปุ่มตอบไม่ขึ้น",
              a: "Role ของคุณเป็น \"POPR\" หรือ \"PR\" ซึ่งตอบไม่ได้ มีเฉพาะ Admin, Approval และ Manager เท่านั้นที่ตอบได้",
            },
          ]}
        />

        {/* ปัญหาอื่นๆ */}
        <FAQCategory
          icon="🔧"
          title="ปัญหาอื่นๆ"
          bgColor="gray"
          questions={[
            {
              q: "หน้าจอแสดงผิดเพี้ยน หรือ Loading ไม่หยุด",
              a: "กด Ctrl+F5 เพื่อ Hard Refresh หรือลอง Clear Cache ของเบราว์เซอร์",
            },
            {
              q: "ค้นหาแล้วไม่เจอ PR ที่ต้องการ",
              a: "ตรวจสอบว่าตั้งค่าช่วงวันที่ครอบคลุมวันที่เปิด PR หรือไม่ และลองกด \"ล้างตัวกรอง\" แล้วค้นหาใหม่",
            },
            {
              q: "Network Share mount failed (System error 67)",
              a: "ระบบยังใช้งานได้ แต่ไฟล์แนบจะเปิดไม่ได้ ให้เชื่อมต่อ Network Share ด้วยตัวเอง: เปิด File Explorer → พิมพ์ \\\\10.1.1.199\\b1_shr → ใส่ Username/Password",
            },
          ]}
        />
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
        <p className="text-sm text-yellow-800">
          💡 <strong>หมายเหตุ:</strong> ถ้ายังแก้ปัญหาไม่ได้ ให้ติดต่อ Admin หรือทีม IT เพื่อขอความช่วยเหลือ
        </p>
      </div>
    </div>
  );
}

// FAQ Category Component
interface FAQQuestion {
  q: string;
  a: string;
  list?: string[];
  solution?: string;
}

interface FAQCategoryProps {
  icon: string;
  title: string;
  bgColor: 'red' | 'orange' | 'blue' | 'purple' | 'gray';
  questions: FAQQuestion[];
}

function FAQCategory({ icon, title, bgColor, questions }: FAQCategoryProps) {
  const colors = {
    red: { border: 'border-red-200', bg: 'bg-red-50', title: 'text-red-900' },
    orange: { border: 'border-orange-200', bg: 'bg-orange-50', title: 'text-orange-900' },
    blue: { border: 'border-blue-200', bg: 'bg-blue-50', title: 'text-blue-900' },
    purple: { border: 'border-purple-200', bg: 'bg-purple-50', title: 'text-purple-900' },
    gray: { border: 'border-gray-200', bg: 'bg-gray-50', title: 'text-gray-900' },
  };
  const c = colors[bgColor];

  return (
    <div className={`border-2 ${c.border} rounded-lg p-5 ${c.bg}`}>
      <h3 className={`font-semibold ${c.title} mb-4 text-lg flex items-center gap-2`}>
        <span>{icon}</span> {title}
      </h3>
      <div className="space-y-4">
        {questions.map((item, i) => (
          <div key={i} className="bg-white rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Q: {item.q}</h4>
            <p className="text-sm text-gray-700 ml-4">
              <strong>A:</strong> {item.a}
            </p>
            {item.list && (
              <ul className="text-sm text-gray-700 ml-8 mt-2 space-y-1">
                {item.list.map((li, j) => (
                  <li key={j}>• {li}</li>
                ))}
              </ul>
            )}
            {item.solution && (
              <p className="text-sm text-gray-700 ml-4 mt-2">
                <strong>แก้ไข:</strong> {item.solution}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
