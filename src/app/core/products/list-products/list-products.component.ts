import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';

import { SessionService } from './../../../services/session.service';
import { ProductsService } from '../../../services/products.service';
import { OrderItem } from '../../../models/orderItem.model';
import { Product } from '../../../models/product.model';
import { CartService } from '../../../services/cart.service';
import { InterceptorSkipHeader } from '../../../services/http.request.interceptor';
import { NgxSpinnerService } from 'ngx-spinner';
import { environment } from '../../../../environments/environment';

declare var $: any;

class DataTablesResponse {
  data: any[];
  draw: number;
  recordsFiltered: number;
  recordsTotal: number;
}

@Component({
  selector: 'app-list-products',
  templateUrl: './list-products.component.html',
  styleUrls: ['./list-products.component.css']
})
export class ListProductsComponent implements OnInit {
  dtOptions: DataTables.Settings = {};
  products: Product[];
  orderItem: OrderItem;
  productListType = 'All';
  userCategory = 'Customer';
  columnDefsTarget = [0, 8];
  defaultOrder = [1, 'asc'];
  tableColumns = [
    { data: 'image' }, { data: 'brand' },
    { data: 'type' }, { data: 'productCode' },
    { data: 'description' }, { data: 'price' },
    { data: 'stock' }, { data: 'quantity' }, { data: 'subtotal' }];
  public brands = [];
  public types = [];

  public selectedType = '';
  public selectedBrand = '';

  public productSubTotal = '0.00';
  public productImage;

  public constructor(private http: HttpClient,
    private productsService: ProductsService,
    private cartService: CartService,
    private location: Location,
    private session: SessionService,
    private spinner: NgxSpinnerService) {
    if (location.path() === '/products/special') {
      this.productListType = 'special';
    } else if (location.path() === '/products/new') {
      this.productListType = 'new';
    } else {
      this.productListType = 'all';
    }
  }

  public ngOnInit(): void {
    console.log(environment.baseUrl);
    if (this.session.retrieveUserCategory()) {
      this.userCategory = this.session.retrieveUserCategory();
    }

    if (this.userCategory === 'Admin') {
      this.tableColumns = [
        { data: 'image' }, { data: 'brand' },
        { data: 'type' }, { data: 'productCode' },
        { data: 'description' }, { data: 'SKU' }, { data: 'price' },
        { data: 'stock' }, { data: 'view' }
      ];
    } else {
      // if user is customer
      if (this.cartService.getCartItems().length > 0) {
        this.defaultOrder = [7, 'asc'];
      }
    }

    this.getProductsData(); // default
    this.getTypes();
    this.getBrands();
  }

  getProductsData() {
    this.spinner.show();
    const headers = new HttpHeaders().set(InterceptorSkipHeader, '');
    this.dtOptions = {
      pagingType: 'simple_numbers',
      serverSide: true,
      autoWidth: false,
      processing: false,
      lengthMenu: [50, 100, 150, 200],
      order: this.defaultOrder,
      ajax: (dataTablesParameters: any, callback) => {
        this.http
          .get<DataTablesResponse>(
            environment.baseUrl + '/products', {
              headers: headers,
              params: {
                productListType: this.productListType,
                userCategory: this.userCategory,
                searchText: dataTablesParameters.search.value,
                brand: this.selectedBrand,
                type: this.selectedType,
                pageNo: dataTablesParameters.start + 1,
                recordsPerPage: dataTablesParameters.length,
                sdir: dataTablesParameters.order[0]['dir'],
                column: dataTablesParameters.columns[dataTablesParameters.order[0]['column']]['data']
              }
            }
          ).subscribe(resp => {
            this.spinner.hide();
            this.products = resp['productList'];

            // If user is a customer then don't show order with stock 0
            if (this.userCategory === 'Customer') {
              this.products = this.products.filter(product => {
                return +product.stock > 0;
              });
            }
            this.products = this.products.map(function (o) {
              o['subtotal'] = 0;
              o['quanity'] = 0;
              return o;
            });
            if (dataTablesParameters.columns[dataTablesParameters.order[0]['column']]['data'] === 'quantity') {
              this.showOrderItemsOnTop(dataTablesParameters.order[0]['dir']);
            }

            this.setQuantityAndSubtotal();

            callback({
              recordsTotal: resp['totalProducts'],
              recordsFiltered: resp['totalProducts'],
              data: []
            });
          }, error => {
            this.spinner.hide();
            console.log(error);
          });
      },
      columns: this.tableColumns,
      columnDefs: [{
        targets: this.columnDefsTarget,
        searchable: false,
        orderable: false,
        visible: true
      },
      { width: '15%', targets: 1 },
      { width: '10%', targets: 3 },
      { width: '30%', targets: 4 },
      { width: '7%', targets: 5 },
      { width: '8%', targets: 6 }
      ],
      language: {
        emptyTable: 'No data available in table',
        loadingRecords: 'Please wait ...',
        zeroRecords: 'No matching records found'
      }
    };
  }

  selectType(value) {
    this.selectedType = value;
    $('#datTable').DataTable().column('Type').search(this.selectedType).draw();
  }

  selectBrand(value) {
    this.selectedBrand = value;
    $('#datTable').DataTable().column('brand').search(this.selectedBrand).draw();
  }

  getBrands() {
    this.productsService.getBrands().then(
      (data: any) => {
        this.brands = data;
      },
      error => {
        console.log('service down ', error);
      });
  }

  getTypes() {
    this.productsService.getTypes().then(
      (data: any) => {
        this.types = data;
      },
      error => {
        console.log('service down ', error);
      });
  }

  calculateProductSubTotal(event, product) {
    if (+event.target.value > +product.stock) {
      event.target.value = product.stock;
    }

    if (+event.target.value < 0) {
      event.target.value = 0;
    }


    const quantity = event.target.value === '' ? 0 : event.target.value;
    const productPrice = product.price;
    const subTotal = (quantity * productPrice);
    if (subTotal === 0) {
      product.subtotal = 0;
    } else {
      product.subtotal = subTotal;
    }
    this.orderItem = new OrderItem();
    this.orderItem.setOrderItem(product, quantity, product.subtotal);
    this.cartService.updateCart(this.orderItem);
    this.products = this.products.map(function (o) {
      if (o['_id'] === product._id) {
        o = product;
      }
      return o;
    });
    this.cartService.cartObservable.next('cartUpdated');
  }

  setQuantityAndSubtotal() {
    const cartItems = this.cartService.getCartItems();
    if (cartItems && cartItems.length > 0) {
      for (let i = 0; i < cartItems.length; i++) {
        for (let j = 0; j < this.products.length; j++) {
          if (cartItems[i].product._id === this.products[j]._id) {
            this.products[j]['quantity'] = +cartItems[i].quantity;
            this.products[j]['subtotal'] = cartItems[i].subtotal;
            break;
          }
        }
      }
    }
  }

  showOrderItemsOnTop(sortOrder: string) {
    const cartItems = this.cartService.getCartItems();
    let tempItems = this.products.slice(0, cartItems.length);
    for (let i = 0; i < cartItems.length; i++) {
      tempItems[i]._id = cartItems[i].product._id;
      tempItems[i].image = cartItems[i].product.image;
      tempItems[i].brand = cartItems[i].product.brand;
      tempItems[i].type = cartItems[i].product.type;
      tempItems[i].productCode = cartItems[i].product.productCode;
      tempItems[i].SKU = cartItems[i].product.SKU;
      tempItems[i].description = cartItems[i].product.description;
      tempItems[i].price = cartItems[i].product.price;
      tempItems[i].stock = cartItems[i].product.stock;
      tempItems[i].quantity = cartItems[i].quantity;
    }

    if (sortOrder === 'desc') {
      tempItems = tempItems.sort((a, b) => {
        return a.quantity - b.quantity;
      });
    } else {
      tempItems = tempItems.sort((a, b) => {
        return b.quantity - a.quantity;
      });
    }

    // following loop will remove cart items from products array(if any)
    if (tempItems.length > 0) {
      for (let i = 0; i < tempItems.length; i++) {
        for (let j = 0; j < this.products.length; j++) {
          if (this.products[j]._id === tempItems[i]._id) {
            this.products.splice(j, 1);
            break;
          }
        }
      }
    }
    // Add cart items at top of products array
    for (let i = 0; i < tempItems.length; i++) {
      this.products.unshift(tempItems[i]);
    }
  }

  public openModal(image) {
    if (image.indexOf('/product_placeholder.png') !== -1) {
      image = image.replace('product_placeholder.png', 'coming_soon.jpg');
    }

    this.productImage = image;
    $('#productImage').attr('src', image);
    $('#imageDialogModal').modal('show');
  }

  sortBasedOnQuantity(sortOrder: string) {
    if (sortOrder === 'asc') {
      this.products = this.products.sort((a, b) => {
        return a['quanity'] - b['quanity'];
      });
    } else {
      this.products = this.products.sort((a, b) => {
        return b['quanity'] - a['quanity'];
      });
    }
  }
}