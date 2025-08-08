# WhatsApp Purchase Analyzer

A Progressive Web App (PWA) built with SvelteKit that analyzes WhatsApp chat history to extract purchase transactions and provides interactive analytics and insights.

## Features

- 📱 **WhatsApp Chat Parsing**: Upload and parse WhatsApp chat export files
- 📊 **Interactive Analytics**: Pie charts, bar charts, and spending trends
- 📝 **Transaction Management**: View, edit, and manage extracted transactions
- 💾 **Data Persistence**: Local storage with optional Supabase sync
- 📱 **PWA Support**: Installable app with offline functionality
- 🎨 **Modern UI**: Built with DaisyUI and Tailwind CSS
- 🔍 **Advanced Filtering**: Search and filter transactions by various criteria
- 📈 **Export Options**: Export data as JSON or CSV

## Tech Stack

- **Frontend**: SvelteKit with TypeScript
- **Styling**: DaisyUI + Tailwind CSS
- **Charts**: Chart.js
- **Database**: Supabase (optional)
- **PWA**: Vite PWA plugin with Workbox
- **Testing**: Vitest + Testing Library

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- (Optional) Supabase account for database sync

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whatsapp-purchase-analyzer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional for Supabase)
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase database** (optional)
   
   If using Supabase, run the SQL commands in `database/schema.sql` in your Supabase SQL editor.

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to `http://localhost:5173`

## Usage

### 1. Export WhatsApp Chat

1. Open WhatsApp on your phone
2. Go to the chat containing purchase transactions
3. Tap the three dots menu → More → Export chat
4. Choose "Without Media"
5. Save the `.txt` file

### 2. Upload and Parse

1. Click "Upload" in the app navigation
2. Drag and drop or select your WhatsApp chat `.txt` file
3. The app will automatically parse transactions
4. Review the parsing results and any errors

### 3. View Analytics

1. Navigate to the "Dashboard" tab
2. View interactive charts showing:
   - Purchase distribution by item (pie chart)
   - Monthly spending trends (bar chart)
   - Spending statistics and insights

### 4. Manage Transactions

1. Go to the "Transactions" tab
2. View all parsed transactions in a table
3. Edit transactions by double-clicking cells
4. Delete individual or multiple transactions
5. Export data as JSON or CSV

### 5. Sync with Database (Optional)

If you've set up Supabase:
1. Click the menu (three dots) in the top navigation
2. Select "Sync to Database" to save transactions
3. Use "Load from Database" to retrieve saved data

## WhatsApp Chat Format

The app expects WhatsApp chat exports in this format:
```
DD/MM/YYYY, HH:MM [am/pm] - Sender: Message
```

Transaction patterns recognized:
- `item amount` (e.g., "milk 100")
- `item: amount` (e.g., "milk: 100")
- `item - amount` (e.g., "milk - 100")
- `amount for item` (e.g., "100 for milk")

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run check` - Type check

### Project Structure

```
src/
├── lib/
│   ├── components/          # Svelte components
│   │   ├── charts/         # Chart components
│   │   ├── FileUpload.svelte
│   │   ├── TransactionTable.svelte
│   │   └── AnalyticsCharts.svelte
│   ├── services/           # Business logic
│   │   ├── whatsappParser.ts
│   │   ├── transactionManager.ts
│   │   ├── supabase.ts
│   │   └── analyticsEngine.ts
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   └── validation/         # Data validation
├── routes/                 # SvelteKit routes
├── test/                   # Test setup
└── sw.ts                   # Service worker
```

### Testing

Run the test suite:
```bash
npm run test
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Building for Production

1. **Build the app**
   ```bash
   npm run build
   ```

2. **Preview the build**
   ```bash
   npm run preview
   ```

The built app will be in the `build/` directory, ready for deployment.

## PWA Features

- **Installable**: Can be installed on mobile devices and desktops
- **Offline Support**: Core functionality works offline
- **Background Sync**: Syncs data when connection is restored
- **Responsive**: Works on all device sizes

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- Mobile browsers with PWA support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Troubleshooting

### Common Issues

**Parsing Errors**: If transactions aren't being parsed correctly:
- Check that your WhatsApp export is in the expected format
- Ensure the chat contains transaction-like messages
- Review parsing errors in the upload results

**Supabase Connection Issues**: 
- Verify your environment variables are set correctly
- Check that your Supabase project is active
- Ensure the database schema has been set up

**PWA Installation Issues**:
- Ensure you're using HTTPS (required for PWA)
- Check that the manifest.json is accessible
- Verify service worker registration

### Performance Tips

- For large chat files (>10MB), parsing may take a few seconds
- Consider filtering your WhatsApp export to only include relevant conversations
- Use the pagination in the transactions table for better performance with many transactions

## Support

If you encounter issues or have questions:
1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Ensure your WhatsApp export format matches the expected pattern
4. Create an issue in the repository with details about your problem