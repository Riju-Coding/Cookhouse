import re

with open('app/admin/qr-links/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Eye to lucide-react imports
content = content.replace(
    'import { Download, Plus, Link as LinkIcon, Trash2, Building2, QrCode, Settings2, User, Mail, IdCard, CheckCircle, XCircle, Loader2 } from "lucide-react"',
    'import { Download, Plus, Link as LinkIcon, Trash2, Building2, QrCode, Settings2, User, Mail, IdCard, CheckCircle, XCircle, Loader2, Eye } from "lucide-react"'
)

# Add ReportPreview import
if 'import ReportPreview' not in content:
    content = content.replace(
        'import { useAuth } from "@/hooks/use-auth"',
        'import { useAuth } from "@/hooks/use-auth"\nimport ReportPreview from "./ReportPreview"'
    )

with open('app/admin/qr-links/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
