export type Language = "bn" | "en";

export interface TranslationMap {
  [key: string]: { bn: string; en: string };
}

export const translations: TranslationMap = {
  // ─── App / Brand ───
  vencon: { bn: "VENCON", en: "VENCON" },
  tagline: { bn: "কোম্পানি অপারেশন ম্যানেজমেন্ট সিস্টেম", en: "Company Operations Management System" },

  // ─── Auth / Login ───
  login: { bn: "Login করুন", en: "Login" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  locked_msg: { bn: "অনেক বেশি ভুল চেষ্টা। অনুগ্রহ করে অপেক্ষা করুন:", en: "Too many failed attempts. Please wait:" },
  invalid_creds: { bn: "ইমেইল বা পাসওয়ার্ড ভুল", en: "Invalid email or password" },
  no_panel_access: { bn: "এই panel-এ আপনার access নেই", en: "You don't have access to this panel" },
  checking_access: { bn: "অ্যাক্সেস যাচাই করা হচ্ছে...", en: "Checking access..." },
  select_panel: { bn: "আপনার প্যানেল নির্বাচন করুন", en: "Select Your Panel" },
  welcome: { bn: "স্বাগতম", en: "Welcome" },

  // ─── Panel Names ───
  sa_panel: { bn: "সুপার অ্যাডমিন প্যানেল", en: "Super Admin Panel" },
  hr_panel: { bn: "এইচআর প্যানেল", en: "HR Panel" },
  tl_panel: { bn: "টিম লিডার প্যানেল", en: "Team Leader Panel" },
  bdo_panel: { bn: "বিডিও প্যানেল", en: "BDO Panel" },
  employee_panel: { bn: "এমপ্লয়ী প্যানেল", en: "Employee Panel" },
  sa_desc: { bn: "ম্যানেজিং ডিরেক্টর, অপারেশন ম্যানেজার, ওয়্যারহাউস ডিরেক্টর", en: "MD, Operations Manager, Warehouse Director" },
  hr_desc: { bn: "এইচআর ম্যানেজার", en: "HR Manager" },
  tl_desc: { bn: "টিম লিডার, সহকারী টিএল, বিজনেস ডেভ ম্যানেজার", en: "Team Leader, Assistant TL, Business Dev Manager" },
  employee_desc: { bn: "টেলিসেলস, ওয়্যারহাউস, কাস্টমার সার্ভিস ইত্যাদি", en: "Telesales, Warehouse, CS, etc." },

  // ─── Navigation ───
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  campaigns: { bn: "ক্যাম্পেইন", en: "Campaigns" },
  employees: { bn: "কর্মীরা", en: "Employees" },
  payroll: { bn: "বেতন", en: "Payroll" },
  attendance: { bn: "উপস্থিতি", en: "Attendance" },
  leads: { bn: "লিড", en: "Leads" },
  logout: { bn: "লগ আউট", en: "Logout" },
  approvals: { bn: "অনুমোদন", en: "Approvals" },
  analytics: { bn: "অ্যানালিটিক্স", en: "Analytics" },
  data_monitor: { bn: "ডাটা মনিটর", en: "Data Monitor" },
  data_tracker: { bn: "ডাটা ট্র্যাকার", en: "Data Tracker" },
  warehouse: { bn: "ওয়্যারহাউস", en: "Warehouse" },
  budget: { bn: "বাজেট", en: "Budget" },
  audit_logs: { bn: "অডিট লগ", en: "Audit Logs" },
  all_data: { bn: "সকল ডাটা", en: "All Data" },
  settings: { bn: "সেটিংস", en: "Settings" },
  main_section: { bn: "প্রধান", en: "Main" },
  settings_section: { bn: "সেটিংস", en: "Settings" },
  leaves: { bn: "ছুটি", en: "Leaves" },
  chat: { bn: "চ্যাট", en: "Chat" },
  my_team: { bn: "আমার টিম", en: "My Team" },
  pre_orders: { bn: "প্রি-অর্ডার", en: "Pre-Orders" },
  delete_sheet: { bn: "ডিলিট শিট", en: "Delete Sheet" },
  my_leads: { bn: "আমার লিডস", en: "My Leads" },
  salary: { bn: "বেতন", en: "Salary" },
  my_orders: { bn: "আমার অর্ডার", en: "My Orders" },
  profile: { bn: "প্রোফাইল", en: "Profile" },
  notifications: { bn: "নোটিফিকেশন", en: "Notifications" },
  documentation: { bn: "ডকুমেন্টেশন", en: "Documentation" },
  chat_admin: { bn: "চ্যাট অ্যাডমিন", en: "Chat Admin" },
  attendance_leaves: { bn: "উপস্থিতি ও ছুটি", en: "Attendance & Leaves" },
  customer_feedback: { bn: "গ্রাহক প্রতিক্রিয়া", en: "Customer Feedback" },
  my_attendance: { bn: "আমার উপস্থিতি", en: "My Attendance" },
  data_requests: { bn: "ডাটা রিকোয়েস্ট", en: "Data Requests" },
  agent_assignment: { bn: "এজেন্ট অ্যাসাইনমেন্ট", en: "Agent Assignment" },

  // ─── Common Actions ───
  save: { bn: "সংরক্ষণ করুন", en: "Save" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  edit: { bn: "সম্পাদনা", en: "Edit" },
  delete: { bn: "মুছুন", en: "Delete" },
  approve: { bn: "অনুমোদন করুন", en: "Approve" },
  reject: { bn: "প্রত্যাখ্যান করুন", en: "Reject" },
  submit: { bn: "জমা দিন", en: "Submit" },
  search: { bn: "অনুসন্ধান করুন", en: "Search" },
  filter: { bn: "ফিল্টার", en: "Filter" },
  export: { bn: "এক্সপোর্ট", en: "Export" },
  print: { bn: "প্রিন্ট করুন", en: "Print" },
  assign: { bn: "assign করুন", en: "Assign" },
  confirm: { bn: "নিশ্চিত করুন", en: "Confirm" },
  view_all: { bn: "সব দেখুন", en: "View All" },
  back: { bn: "ফিরে যান", en: "Back" },
  loading: { bn: "লোড হচ্ছে...", en: "Loading..." },
  no_data: { bn: "কোনো ডেটা নেই", en: "No data" },
  submitting: { bn: "সাবমিট হচ্ছে...", en: "Submitting..." },
  success: { bn: "সফল", en: "Success" },
  error: { bn: "ত্রুটি", en: "Error" },
  close: { bn: "বন্ধ করুন", en: "Close" },
  add: { bn: "যোগ করুন", en: "Add" },
  update: { bn: "আপডেট করুন", en: "Update" },
  retry: { bn: "পুনরায় চেষ্টা করুন", en: "Retry" },
  yes: { bn: "হ্যাঁ", en: "Yes" },
  no: { bn: "না", en: "No" },
  total: { bn: "মোট", en: "Total" },
  active: { bn: "সক্রিয়", en: "Active" },
  inactive: { bn: "নিষ্ক্রিয়", en: "Inactive" },
  pending: { bn: "পেন্ডিং", en: "Pending" },
  approved_status: { bn: "সক্রিয়", en: "Active" },
  pending_sa: { bn: "SA পেন্ডিং", en: "Pending SA" },
  draft: { bn: "ড্রাফট", en: "Draft" },

  // ─── Lead Statuses (all 20) ───
  status_order_confirm: { bn: "অর্ডার নিশ্চিত", en: "Order Confirm" },
  status_pre_order: { bn: "প্রি-অর্ডার", en: "Pre Order" },
  status_phone_off: { bn: "ফোন বন্ধ", en: "Phone Off" },
  status_positive: { bn: "ইতিবাচক", en: "Positive" },
  status_customer_reschedule: { bn: "পুনরায় নির্ধারণ", en: "Customer Reschedule" },
  status_do_not_pick: { bn: "ফোন ধরছে না", en: "Do Not Pick" },
  status_no_response: { bn: "কোনো সাড়া নেই", en: "No Response" },
  status_busy_now: { bn: "এখন ব্যস্ত", en: "Busy Now" },
  status_number_busy: { bn: "নম্বর ব্যস্ত", en: "Number Busy" },
  status_negative: { bn: "নেতিবাচক", en: "Negative" },
  status_not_interested: { bn: "আগ্রহী নন", en: "Not Interested" },
  status_cancelled: { bn: "বাতিলকৃত", en: "Cancelled" },
  status_wrong_number: { bn: "ভুল নম্বর", en: "Wrong Number" },
  status_duplicate: { bn: "ডুপ্লিকেট", en: "Duplicate" },
  status_already_ordered: { bn: "আগেই অর্ডার করেছেন", en: "Already Ordered" },
  status_call_back_later: { bn: "পরে কল করুন", en: "Call Back Later" },
  status_out_of_coverage: { bn: "নেটওয়ার্কের বাইরে", en: "Out of Coverage" },
  status_switch_off: { bn: "সুইচ অফ", en: "Switch Off" },
  status_not_reachable: { bn: "যোগাযোগ করা যাচ্ছে না", en: "Not Reachable" },
  status_call_done: { bn: "কল সম্পন্ন", en: "Call Done" },
  status_follow_up: { bn: "ফলো আপ", en: "Follow Up" },
  status_fresh: { bn: "নতুন", en: "Fresh" },
  status_tl_delete_sheet: { bn: "ডিলিট শিট", en: "Delete Sheet" },

  // ─── Order Statuses ───
  order_pending_cso: { bn: "CSO Review-এর অপেক্ষায়", en: "Pending CSO Review" },
  order_send_today: { bn: "আজ পাঠানো হবে", en: "Send Today" },
  order_dispatched: { bn: "পাঠানো হয়েছে", en: "Dispatched" },
  order_delivered: { bn: "ডেলিভারি হয়েছে", en: "Delivered" },
  order_returned: { bn: "ফেরত এসেছে", en: "Returned" },
  order_cancelled: { bn: "বাতিলকৃত", en: "Cancelled" },
  order_rejected: { bn: "প্রত্যাখ্যাত", en: "Rejected" },

  // Delivery statuses
  delivery_pending: { bn: "পেন্ডিং", en: "Pending" },
  delivery_in_transit: { bn: "পথে আছে", en: "In Transit" },
  delivery_delivered: { bn: "ডেলিভারি হয়েছে", en: "Delivered" },
  delivery_returned: { bn: "ফেরত এসেছে", en: "Returned" },
  delivery_failed: { bn: "ব্যর্থ", en: "Failed" },

  // ─── Employee Roles (all 14) ───
  role_telesales_executive: { bn: "টেলিসেলস এক্সিকিউটিভ", en: "Telesales Executive" },
  role_team_leader: { bn: "টিম লিডার", en: "Team Leader" },
  role_assistant_team_leader: { bn: "সহকারী টিম লিডার", en: "Assistant Team Leader" },
  role_group_leader: { bn: "গ্রুপ লিডার", en: "Group Leader" },
  role_cs_executive: { bn: "কাস্টমার সাপোর্ট এক্সিকিউটিভ", en: "Customer Support Executive" },
  role_cso: { bn: "কাস্টমার সিকিউরিটি অফিসার", en: "Customer Security Officer" },
  role_warehouse_assistant: { bn: "ওয়্যারহাউস অ্যাসিস্ট্যান্ট", en: "Warehouse Assistant" },
  role_warehouse_supervisor: { bn: "ওয়্যারহাউস সুপারভাইজার", en: "Warehouse Supervisor" },
  role_inventory_manager: { bn: "ইনভেন্টরি ম্যানেজার", en: "Inventory Manager" },
  role_delivery_coordinator: { bn: "ডেলিভারি কোঅর্ডিনেটর", en: "Delivery Coordinator" },
  role_maintenance_officer: { bn: "মেইনটেন্যান্স অফিসার", en: "Maintenance Officer" },
  role_office_assistant: { bn: "অফিস অ্যাসিস্ট্যান্ট", en: "Office Assistant" },
  role_creative_hr_manager: { bn: "ক্রিয়েটিভ ও এইচআর ম্যানেজার", en: "Creative And Human Resource Manager" },
  role_bdo_manager: { bn: "বিজনেস ডেভেলপমেন্ট ম্যানেজার", en: "Business Development And Marketing Manager" },

  // ─── Salary Display ───
  basic_salary: { bn: "মূল বেতন", en: "Basic Salary" },
  incentive: { bn: "ইনসেন্টিভ", en: "Incentive" },
  profit_share: { bn: "প্রফিট শেয়ার", en: "Profit Share" },
  deductions: { bn: "কর্তন", en: "Deductions" },
  net_salary: { bn: "নিট বেতন", en: "Net Salary" },
  this_month_salary: { bn: "এই মাসের বেতন (চলতি)", en: "This Month's Salary (Running)" },
  receive_ratio: { bn: "রিসিভ রেশিও", en: "Receive Ratio" },
  deductions_late_leave: { bn: "কর্তন (বিলম্ব + ছুটি)", en: "Deductions (Late + Leave)" },
  sales_ratio: { bn: "সেলস রেশিও", en: "Sales Ratio" },
  cancel_ratio: { bn: "ক্যান্সেল রেশিও", en: "Cancel Ratio" },
  return_ratio: { bn: "রিটার্ন রেশিও", en: "Return Ratio" },

  // ─── Payroll Page ───
  payroll_incentives: { bn: "পে-রোল ও ইনসেন্টিভ", en: "Payroll & Incentives" },
  incentive_tiers: { bn: "ইনসেন্টিভ টায়ার্স", en: "Incentive Tiers" },
  edit_tiers: { bn: "Tiers সম্পাদনা করুন", en: "Edit Tiers" },
  min_threshold: { bn: "সর্বনিম্ন থ্রেশহোল্ড", en: "Min Threshold" },
  per_delivery: { bn: "প্রতি ডেলিভারি", en: "per delivery" },
  no_tiers: { bn: "কোনো টায়ার কনফিগার করা হয়নি", en: "No tiers configured" },
  profit_share_config: { bn: "প্রফিট শেয়ার কনফিগ", en: "Profit Share Config" },
  pool_percentage: { bn: "পুলের %", en: "% of Pool" },
  role: { bn: "রোল", en: "Role" },
  total_must_100: { bn: "⚠ মোট ১০০% হতে হবে", en: "⚠ Total must equal 100%" },
  submit_sa_approval: { bn: "SA Approval-এর জন্য Submit করুন", en: "Submit for SA Approval" },
  submitted_for_approval: { bn: "SA approval-এর জন্য submit হয়েছে ✓", en: "Submitted for SA approval ✓" },
  salary_preview: { bn: "বেতন প্রিভিউ", en: "Salary Preview" },
  name: { bn: "নাম", en: "Name" },
  min_receive_threshold: { bn: "সর্বনিম্ন রিসিভ রেশিও থ্রেশহোল্ড %", en: "Min Receive Ratio Threshold %" },
  below_zero_incentive: { bn: "এর নিচে = শূন্য ইনসেন্টিভ", en: "Below this = zero incentive" },
  from: { bn: "থেকে", en: "from" },
  to: { bn: "পর্যন্ত", en: "to" },
  add_tier_row: { bn: "আরেকটি টায়ার যোগ করুন", en: "Add Row" },
  edit_tier_title: { bn: "টায়ার সম্পাদনা", en: "Edit Tiers" },

  // ─── Mood Options ───
  mood_happy: { bn: "সুখী", en: "Happy" },
  mood_sad: { bn: "দুঃখী", en: "Sad" },
  mood_excited: { bn: "উৎসাহিত", en: "Excited" },
  mood_tired: { bn: "ক্লান্ত", en: "Tired" },
  mood_neutral: { bn: "স্বাভাবিক", en: "Neutral" },
  mood_angry: { bn: "রাগান্বিত", en: "Angry" },

  // ─── Attendance ───
  clock_in: { bn: "Check In করুন", en: "Check In" },
  clock_out: { bn: "Check Out করুন", en: "Check Out" },
  desk_report: { bn: "ডেস্ক ও ফোন রিপোর্ট", en: "Desk & Phone Report" },
  desk_condition: { bn: "ডেস্কের অবস্থা", en: "Desk Condition" },
  desk_good: { bn: "ভালো", en: "Good" },
  desk_acceptable: { bn: "গ্রহণযোগ্য", en: "Acceptable" },
  desk_needs_repair: { bn: "মেরামত দরকার", en: "Needs Repair" },
  phone_minutes: { bn: "ফোনে অবশিষ্ট মিনিট", en: "Phone Minutes Remaining" },
  desk_report_pending: { bn: "⚠️ আজকের ডেস্ক এবং ফোন রিপোর্ট এখনো দেওয়া হয়নি!", en: "⚠️ Today's desk and phone report not yet submitted!" },
  click_to_report: { bn: "রিপোর্ট দিতে ক্লিক করুন", en: "Click to submit report" },
  desk_report_saved: { bn: "ডেস্ক রিপোর্ট সংরক্ষণ করা হয়েছে", en: "Desk report saved" },
  select_desk_condition: { bn: "ডেস্কের অবস্থা নির্বাচন করুন", en: "Select desk condition" },
  mood_select: { bn: "মুড নির্বাচন করুন", en: "Select mood" },
  mood_write: { bn: "আজকের অনুভূতি সম্পর্কে লিখুন (optional)", en: "Write about today's feeling (optional)" },
  clock_in_success: { bn: "Check In সফল ✓", en: "Check In successful ✓" },
  clock_in_late: { bn: "Check In হয়েছে (Late entry — ৳33 কর্তন)", en: "Checked In (Late entry — ৳33 deduction)" },
  clock_out_success: { bn: "Check Out সফল ✓", en: "Check Out successful ✓" },
  clock_out_early: { bn: "Check Out হয়েছে (Early out — ৳33 কর্তন)", en: "Checked Out (Early out — ৳33 deduction)" },
  outside_shift: { bn: "আপনার shift এখন নেই।", en: "You're outside your shift hours." },
  personal_info_only: { bn: "শুধুমাত্র ব্যক্তিগত তথ্য দেখা যাচ্ছে।", en: "Only personal information is visible." },
  not_clocked_in: { bn: "আপনি এখনো Check In করেননি", en: "You haven't checked in yet" },
  clock_in_to_start: { bn: "কাজ শুরু করতে Check In করুন", en: "Check in to start working" },

  // ─── Lead Sheet ───
  lead_sheet: { bn: "লিড শিট", en: "Lead Sheet" },
  bronze_leads: { bn: "Bronze Leads", en: "Bronze Leads" },
  silver_leads: { bn: "Silver Leads", en: "Silver Leads" },
  customer: { bn: "কাস্টমার", en: "Customer" },
  phone: { bn: "ফোন", en: "Phone" },
  city: { bn: "শহর", en: "City" },
  status: { bn: "স্ট্যাটাস", en: "Status" },
  called: { bn: "কল", en: "Called" },
  note: { bn: "নোট", en: "Note" },
  select_status: { bn: "স্ট্যাটাস নির্বাচন করুন", en: "Select status" },
  lead_updated: { bn: "Lead আপডেট হয়েছে", en: "Lead updated" },
  requeue_wait: { bn: "মিনিট অপেক্ষা করুন", en: "min wait" },

  // ─── Order ───
  order_confirm_title: { bn: "অর্ডার নিশ্চিত করুন", en: "Confirm Order" },
  customer_name: { bn: "কাস্টমার নাম", en: "Customer Name" },
  address: { bn: "ঠিকানা", en: "Address" },
  product: { bn: "পণ্য", en: "Product" },
  quantity: { bn: "পরিমাণ", en: "Quantity" },
  price: { bn: "মূল্য", en: "Price" },
  select_product: { bn: "পণ্য নির্বাচন করুন", en: "Select product" },
  order_confirmed: { bn: "অর্ডার নিশ্চিত হয়েছে ✓", en: "Order confirmed ✓" },
  order_error: { bn: "অর্ডার তৈরিতে সমস্যা", en: "Error creating order" },
  pre_order_title: { bn: "প্রি-অর্ডার তৈরি করুন", en: "Create Pre-Order" },
  pre_order_date: { bn: "নির্ধারিত তারিখ", en: "Scheduled Date" },
  pre_order_created: { bn: "Pre-order তৈরি হয়েছে ✓", en: "Pre-order created ✓" },
  select_date: { bn: "তারিখ নির্বাচন করুন", en: "Select date" },

  // ─── Notifications ───
  no_notifications: { bn: "কোনো বিজ্ঞপ্তি নেই", en: "No notifications" },
  mark_all_read: { bn: "সব পড়া হিসেবে চিহ্নিত করুন", en: "Mark all as read" },
  view_all_notifications: { bn: "সব notification দেখুন →", en: "View all notifications →" },
  notification_history: { bn: "বিজ্ঞপ্তি ইতিহাস", en: "Notification History" },
  all_types: { bn: "সব ধরন", en: "All Types" },
  all_status: { bn: "সব স্ট্যাটাস", en: "All Status" },
  read: { bn: "পঠিত", en: "Read" },
  unread: { bn: "অপঠিত", en: "Unread" },
  previous: { bn: "পূর্ববর্তী", en: "Previous" },
  next: { bn: "পরবর্তী", en: "Next" },
  page: { bn: "পৃষ্ঠা", en: "Page" },

  // ─── Empty States ───
  no_leads: { bn: "কোনো lead নেই। TL থেকে lead assign হওয়ার অপেক্ষায়।", en: "No leads yet. Waiting for TL to assign leads." },
  no_orders_cso: { bn: "Review-এর জন্য কোনো order নেই। ✓", en: "No orders pending review. ✓" },
  no_orders_warehouse: { bn: "Dispatch করার কোনো order নেই।", en: "No orders ready for dispatch." },

  // ─── Chat ───
  new_conversation: { bn: "নতুন কথোপকথন", en: "New Conversation" },
  direct_messages: { bn: "সরাসরি বার্তা", en: "Direct Messages" },
  groups: { bn: "গ্রুপ", en: "Groups" },
  type_message: { bn: "মেসেজ লিখুন...", en: "Type a message..." },
  send: { bn: "পাঠান", en: "Send" },
  typing: { bn: "টাইপ করছে...", en: "typing..." },
  members: { bn: "সদস্য", en: "Members" },
  create_group: { bn: "গ্রুপ তৈরি করুন", en: "Create Group" },
  group_name: { bn: "গ্রুপের নাম", en: "Group Name" },
  select_members: { bn: "সদস্য নির্বাচন করুন", en: "Select Members" },

  // ─── AI Chat ───
  ai_assistant: { bn: "Vencon অ্যাসিস্ট্যান্ট", en: "Vencon Assistant" },
  ai_welcome: { bn: "আমি আপনাকে কিভাবে সাহায্য করতে পারি?", en: "How can I help you?" },
  ask_question: { bn: "প্রশ্ন করুন...", en: "Ask a question..." },

  // ─── Dashboard Cards ───
  total_orders: { bn: "মোট অর্ডার", en: "Total Orders" },
  total_leads: { bn: "মোট লিড", en: "Total Leads" },
  total_employees: { bn: "মোট কর্মী", en: "Total Employees" },
  total_revenue: { bn: "মোট আয়", en: "Total Revenue" },
  today: { bn: "আজ", en: "Today" },
  this_month: { bn: "এই মাস", en: "This Month" },
  this_week: { bn: "এই সপ্তাহ", en: "This Week" },

  // ─── Warehouse ───
  send_to_steadfast: { bn: "SteadFast-এ পাঠান", en: "Send to SteadFast" },
  dispatch: { bn: "ডিসপ্যাচ", en: "Dispatch" },
  consignment_id: { bn: "কনসাইনমেন্ট আইডি", en: "Consignment ID" },
  print_label: { bn: "লেবেল প্রিন্ট করুন", en: "Print Label" },
  select_all: { bn: "সব নির্বাচন করুন", en: "Select All" },
  bulk_dispatch: { bn: "বাল্ক ডিসপ্যাচ", en: "Bulk Dispatch" },
  sending: { bn: "পাঠানো হচ্ছে...", en: "Sending..." },
  send_failed: { bn: "পাঠাতে ব্যর্থ", en: "Send Failed" },

  // ─── Inventory ───
  stock_in: { bn: "স্টক ইন", en: "Stock In" },
  dispatched_stock: { bn: "ডিসপ্যাচ", en: "Dispatched" },
  returned_stock: { bn: "রিটার্ন", en: "Returned" },
  damaged: { bn: "ক্ষতিগ্রস্ত", en: "Damaged" },
  current_stock: { bn: "বর্তমান স্টক", en: "Current Stock" },
  low_stock: { bn: "স্টক কম", en: "Low Stock" },
  unit_price: { bn: "একক মূল্য", en: "Unit Price" },

  // ─── Maintenance ───
  expense: { bn: "ব্যয়", en: "Expense" },
  description: { bn: "বিবরণ", en: "Description" },
  amount: { bn: "পরিমাণ", en: "Amount" },
  category: { bn: "ক্যাটাগরি", en: "Category" },
  date: { bn: "তারিখ", en: "Date" },
  add_expense: { bn: "ব্যয় যোগ করুন", en: "Add Expense" },

  // ─── HR Employee Management ───
  add_employee: { bn: "কর্মী যোগ করুন", en: "Add Employee" },
  employee_details: { bn: "কর্মীর বিবরণ", en: "Employee Details" },
  department: { bn: "বিভাগ", en: "Department" },
  designation: { bn: "পদবী", en: "Designation" },
  shift_start: { bn: "শিফট শুরু", en: "Shift Start" },
  shift_end: { bn: "শিফট শেষ", en: "Shift End" },
  off_days: { bn: "ছুটির দিন", en: "Off Days" },
  father_name: { bn: "পিতার নাম", en: "Father's Name" },
  mother_name: { bn: "মাতার নাম", en: "Mother's Name" },
  guardian_phone: { bn: "অভিভাবকের ফোন", en: "Guardian's Phone" },

  // ─── Delivery ───
  delivery_coordinator_dashboard: { bn: "ডেলিভারি কোঅর্ডিনেটর ড্যাশবোর্ড", en: "Delivery Coordinator Dashboard" },
  overtime_hours: { bn: "ওভারটাইম ঘণ্টা", en: "Overtime Hours" },
  tracking: { bn: "ট্র্যাকিং", en: "Tracking" },

  // ─── CS Executive ───
  call_queue: { bn: "কল কিউ", en: "Call Queue" },
  call_done: { bn: "কল সম্পন্ন", en: "Call Done" },
  rating: { bn: "রেটিং", en: "Rating" },
  cs_note: { bn: "CS নোট", en: "CS Note" },

  // ─── Group Leader ───
  group_leader_dashboard: { bn: "গ্রুপ লিডার ড্যাশবোর্ড", en: "Group Leader Dashboard" },
  group_average: { bn: "গ্রুপ গড়", en: "Group Average" },
  agent_performance: { bn: "এজেন্ট পারফরম্যান্স", en: "Agent Performance" },

  // ─── Load More / Pagination ───
  load_more: { bn: "আরো দেখুন", en: "Load More" },
  showing_n_of_total: { bn: "দেখাচ্ছে", en: "Showing" },

  // ─── Confirmation Messages ───
  confirm_delete_lead: { bn: "এই lead delete করতে চান? এটি undo করা যাবে না।", en: "Are you sure you want to delete this lead? This cannot be undone." },
  confirm_reject_hire: { bn: "এই hire request reject করতে চান?", en: "Are you sure you want to reject this hire request?" },
  confirm_delete_title: { bn: "নিশ্চিত করুন", en: "Confirm" },

  // ─── Success Toasts ───
  toast_lead_assigned: { bn: "Lead assign করা হয়েছে ✓", en: "Lead assigned ✓" },
  toast_order_confirmed: { bn: "Order confirm হয়েছে ✓", en: "Order confirmed ✓" },
  toast_saved: { bn: "সংরক্ষণ হয়েছে ✓", en: "Saved ✓" },

  // ─── Error States ───
  error_loading_data: { bn: "ডেটা লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", en: "Failed to load data. Please try again." },
  
  // ─── Misc ───
  of: { bn: "এর", en: "of" },
  selected: { bn: "নির্বাচিত", en: "selected" },
  actions: { bn: "অ্যাকশন", en: "Actions" },
  details: { bn: "বিবরণ", en: "Details" },
  created_at: { bn: "তৈরির সময়", en: "Created At" },
  updated_at: { bn: "আপডেটের সময়", en: "Updated At" },
  type: { bn: "ধরন", en: "Type" },
  all: { bn: "সব", en: "All" },
  info: { bn: "তথ্য", en: "Info" },
  warning: { bn: "সতর্কতা", en: "Warning" },
};

// Bengali numerals
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => BN_DIGITS[parseInt(d)]);
}

// Bengali month names
const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

export function formatDateBn(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  return `${toBengaliNum(d)} ${BN_MONTHS[m]} ${toBengaliNum(y)}`;
}

export function formatNumLocale(n: number, lang: Language): string {
  const formatted = Math.round(n).toLocaleString("en-IN");
  return lang === "bn" ? toBengaliNum(formatted) : formatted;
}

// Helper to get translated role name
export function getRoleName(roleKey: string, lang: Language): string {
  const key = `role_${roleKey}`;
  return translations[key]?.[lang] || roleKey.replace(/_/g, " ");
}

// Helper to get translated status name
export function getStatusName(statusKey: string, lang: Language): string {
  const key = `status_${statusKey}`;
  return translations[key]?.[lang] || statusKey.replace(/_/g, " ");
}
